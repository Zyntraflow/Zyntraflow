import { getAddress } from "ethers";
import { buildAlertEvents, persistAlerts, type AlertEvent } from "./alerts/alertEngine";
import { sendDiscordAlert, type DiscordSendResult } from "./alerts/discordSender";
import { checkAccessPassAcrossChains } from "./access/accessPass";
import { buildMintInstructions } from "./access/mintInstructions";
import type { AccessStatus } from "./access/types";
import { sendTelegramAlert, type TelegramSendResult } from "./alerts/telegramSender";
import { dispatchWebhookAlerts } from "./alerts/webhookSender";
import { buildLoginMessage, buildNonce } from "./auth/siwe";
import { MissingConfigError, loadConfig } from "./config";
import { getChainConfig } from "./chains/chains";
import { parseCliArgs } from "./cli/args";
import { logger } from "./logger";
import { getEnabledPairsForChainByKeys, toPairKey, type PairConfig } from "./pairs/pairs";
import { buildPremiumPackage } from "./premium/packageBuilder";
import type { PremiumPackage } from "./premium/packageTypes";
import { storePremiumPackage, storeSignedFreeSummary } from "./premium/packageStorage";
import { resolvePremiumDecision } from "./premium/premiumGating";
import { checkAndConsumePremiumRateLimit } from "./premium/rateLimit";
import { selectProfile } from "./profiles/profileSelector";
import { publishJson, type PublishResult } from "./publishing/ipfsPublisher";
import { MockQuoteSource } from "./quotes/mockQuoteSource";
import type { IQuoteSource } from "./quotes/IQuoteSource";
import { UniswapV2QuoteSource } from "./quotes/uniswapV2QuoteSource";
import { UniswapV3QuoteSource } from "./quotes/uniswapV3QuoteSource";
import { buildFreeSummary } from "./reporting/freeSummary";
import { signFreeSummary } from "./reporting/freeSummarySigned";
import { computeReportHash } from "./reporting/reportHash";
import { writeScanReport } from "./reporting/reportWriter";
import { buildStatusSnapshot } from "./reporting/statusSnapshot";
import { loadRpcEndpoints } from "./rpc/endpoints";
import { RpcManager, type RpcProviderClient } from "./rpc/manager";
import { closeRpcManagers, createAccessPassRpcManagers, createAlchemyRpcManagers, getProvidersByChain } from "./rpc/multiChain";
import { runMultiChainScan } from "./scanner/multiChainScan";
import { listSubscriptions } from "./subscriptions/subscriptionStore";

const sanitizeErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : "Unknown error";
  return rawMessage
    .replace(/(https?:\/\/[^\s?#]+)\?([^\s#]+)/gi, "$1?[REDACTED]")
    .replace(/(\/v2\/)([^/\s?#]+)/gi, "$1[REDACTED]");
};

const normalizeAddress = (address?: string): string | undefined => {
  if (!address) {
    return undefined;
  }

  try {
    return getAddress(address.trim());
  } catch {
    throw new Error(`Invalid wallet address: ${address}`);
  }
};

const printMintInfo = (status: AccessStatus, mintPriceWei?: string): void => {
  process.stdout.write(
    [
      "Access Pass Mint Info",
      `chainId: ${status.chainId}`,
      `contract: ${status.contract || "NOT_CONFIGURED"}`,
      `tokenId: ${status.tokenId}`,
      `minBalance: ${status.minBalance}`,
      `mintPriceWei: ${mintPriceWei ?? "set during contract deployment"}`,
      "Mint via contract mint() function",
    ].join("\n") + "\n",
  );
};

const printMintCalldata = (status: AccessStatus, mintPriceWei?: string): void => {
  if (!status.contract) {
    throw new Error("Cannot build mint calldata: ACCESS_PASS_CONTRACT_ADDRESS is not configured.");
  }

  const instructions = buildMintInstructions({
    chainId: status.chainId,
    contractAddress: status.contract,
    mintPriceWei,
  });

  process.stdout.write(
    [
      "Access Pass Mint Calldata",
      `chainId: ${instructions.chainId}`,
      `to: ${instructions.to}`,
      `value: ${instructions.value}`,
      `function: ${instructions.functionSignature}`,
      `data: ${instructions.data}`,
      `eip681: ${instructions.eip681}`,
    ].join("\n") + "\n",
  );
};

const buildQuoteSourcesForChain = (
  pairKeys: string[],
  provider: RpcProviderClient,
  blockNumber: number | null,
  config: ReturnType<typeof loadConfig>,
  requestedSources: Array<"univ2" | "univ3">,
): IQuoteSource[] => {
  const mockPrices = Object.fromEntries(
    pairKeys.map((pairKey) => {
      const [, quoteSymbol = "USDC"] = pairKey.split("/");
      const basePrice = quoteSymbol === "USDC" || quoteSymbol === "DAI" ? 3000 : 1;
      return [pairKey, basePrice];
    }),
  );

  const sources: IQuoteSource[] = [
    new MockQuoteSource({
      prices: mockPrices,
      fixedBlockNumber: blockNumber ?? undefined,
    }),
  ];

  if (requestedSources.includes("univ2")) {
    sources.push(
      new UniswapV2QuoteSource(provider, {
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
        retryJitterMs: Math.min(config.OPERATOR_JITTER_MS, 1000),
      }),
    );
  }

  if (requestedSources.includes("univ3")) {
    sources.push(
      new UniswapV3QuoteSource(provider, {
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
        retryJitterMs: Math.min(config.OPERATOR_JITTER_MS, 1000),
      }),
    );
  }

  return sources;
};

const main = async (): Promise<void> => {
  let rpcManager: RpcManager | null = null;
  let scanManagersByChain: Record<number, RpcManager> = {};
  let accessManagersByChain: Record<number, RpcManager> = {};

  try {
    const cliArgs = parseCliArgs();
    const operatorMode = cliArgs.operatorOverride === true;
    if (cliArgs.printLoginMessage) {
      const loginAddress = normalizeAddress(cliArgs.address ?? process.env.USER_WALLET_ADDRESS);
      if (!loginAddress) {
        throw new Error("Missing wallet address. Provide --address to print a login message.");
      }

      const nonce = buildNonce();
      const loginMessage = buildLoginMessage(loginAddress, nonce);
      process.stdout.write(
        ["Sign this message with your wallet:", `Address: ${loginAddress}`, `Nonce: ${nonce}`, loginMessage].join(
          "\n",
        ) + "\n",
      );
      return;
    }

    const config = loadConfig();
    const rpcEndpoints = loadRpcEndpoints(config);
    rpcManager = new RpcManager(rpcEndpoints, {
      timeoutMs: config.RPC_TIMEOUT_MS,
      retryMax: config.RPC_RETRY_MAX,
      retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
      retryJitterMs: Math.min(config.OPERATOR_JITTER_MS, 1000),
    });
    const bestRpc = await rpcManager.getBestProvider();
    const provider = bestRpc.provider;

    const network = await provider.getNetwork();
    const detectedChainId = typeof network.chainId === "bigint" ? Number(network.chainId) : network.chainId;
    const defaultScanChainId = config.CHAIN_ID ?? bestRpc.health.chainId ?? detectedChainId;
    const defaultChain = getChainConfig(defaultScanChainId);

    const premiumRequested = cliArgs.premiumOverride ?? config.ENABLE_PREMIUM_MODE;
    const candidateAddress = normalizeAddress(cliArgs.address ?? config.USER_WALLET_ADDRESS);
    const acceptedAccessChains =
      config.ACCESS_PASS_ACCEPTED_CHAINS.length > 0
        ? config.ACCESS_PASS_ACCEPTED_CHAINS
        : [config.ACCESS_PASS_CHAIN_ID ?? defaultScanChainId];
    const contractByChain = {
      ...config.ACCESS_PASS_CONTRACTS_BY_CHAIN,
    };
    if (config.ACCESS_PASS_CHAIN_ID && config.ACCESS_PASS_CONTRACT_ADDRESS) {
      contractByChain[config.ACCESS_PASS_CHAIN_ID] = config.ACCESS_PASS_CONTRACT_ADDRESS;
    }
    const selectedAccessChain = config.ACCESS_PASS_CHAIN_ID ?? acceptedAccessChains[0] ?? defaultScanChainId;
    const selectedAccessContract = contractByChain[selectedAccessChain] ?? config.ACCESS_PASS_CONTRACT_ADDRESS ?? "";

    const accessStatus: AccessStatus = {
      enabled: premiumRequested,
      chainId: selectedAccessChain,
      contract: selectedAccessContract,
      tokenId: config.ACCESS_PASS_TOKEN_ID,
      minBalance: config.ACCESS_PASS_MIN_BALANCE,
      acceptedChains: acceptedAccessChains,
      contractsByChain: contractByChain,
    };

    if (cliArgs.mintInfo) {
      printMintInfo(accessStatus, config.ACCESS_PASS_MINT_PRICE_WEI);
    }

    if (cliArgs.mintCalldata) {
      printMintCalldata(accessStatus, config.ACCESS_PASS_MINT_PRICE_WEI);
    }

    let hasAccess = false;
    let accessBalance = "0";
    let accessErrors: string[] = [];
    let matchedAccessChain: number | undefined;
    let premiumNotice: string | null = null;

    if (premiumRequested) {
      if (!candidateAddress) {
        premiumNotice = "Premium locked: mint Access Pass to unlock";
      } else if (!accessStatus.contractsByChain || Object.keys(accessStatus.contractsByChain).length === 0) {
        premiumNotice = "Premium locked: mint Access Pass to unlock";
      } else {
        try {
          const accessManagerInit = createAccessPassRpcManagers(config, accessStatus.acceptedChains ?? []);
          accessManagersByChain = accessManagerInit.managersByChain;
          accessErrors.push(...accessManagerInit.errors);
          const chainProviderResult = await getProvidersByChain(accessManagersByChain);
          accessErrors.push(...chainProviderResult.errors);

          const access = await checkAccessPassAcrossChains(
            chainProviderResult.providersByChain,
            candidateAddress,
            accessStatus,
          );
          hasAccess = access.hasAccess;
          accessBalance = access.balance;
          matchedAccessChain = access.matchedChainId;
          accessErrors = accessErrors.concat(access.errors ?? []);
          if (!hasAccess) {
            premiumNotice = "Premium locked: mint Access Pass to unlock";
          }
        } catch (error) {
          premiumNotice = "Premium locked: mint Access Pass to unlock";
          logger.warn(
            { error: sanitizeErrorMessage(error) },
            "Access Pass verification failed; falling back to free mode",
          );
        }
      }
    }

    const selectedProfile = selectProfile({
      targetNetwork: config.TARGET_NETWORK || defaultChain.name,
      defaultMinProfitGap: config.MIN_PROFIT_GAP,
      premiumEnabled: premiumRequested && hasAccess,
      requestedProfileId: cliArgs.profileId,
      requestedChains: cliArgs.chains,
      requestedPairs: cliArgs.pairs,
      globalMaxConcurrency: config.RPC_MAX_CONCURRENCY,
      globalIntervalSeconds: cliArgs.intervalOverride ?? config.OPERATOR_INTERVAL_SECONDS,
    });
    for (const warning of selectedProfile.warnings) {
      logger.warn({ profile: selectedProfile.id }, warning);
    }
    process.stdout.write(`Using scan profile: ${selectedProfile.id}\n`);

    const scanChains = selectedProfile.chains.length > 0 ? selectedProfile.chains : [defaultScanChainId];
    const scanManagerInit = createAlchemyRpcManagers(config, scanChains, "scan-chain");
    scanManagersByChain = scanManagerInit.managersByChain;
    const scanProviderErrors = [...scanManagerInit.errors];
    const scanBestByChain: Record<number, { provider: RpcProviderClient; endpointName: string; blockNumber: number | null }> = {};
    for (const chainId of scanChains) {
      const chainManager = scanManagersByChain[chainId];
      if (!chainManager) {
        scanProviderErrors.push(`Missing RPC manager for chain ${chainId}.`);
        continue;
      }
      try {
        const best = await chainManager.getBestProvider();
        scanBestByChain[chainId] = {
          provider: best.provider,
          endpointName: best.endpoint.name,
          blockNumber: best.health.blockNumber,
        };
      } catch (error) {
        scanProviderErrors.push(`chain ${chainId}: ${sanitizeErrorMessage(error)}`);
      }
    }

    const availablePairsByChain: Record<number, PairConfig[]> = {};
    for (const chainId of scanChains) {
      availablePairsByChain[chainId] = getEnabledPairsForChainByKeys(chainId, selectedProfile.pairs);
    }
    const totalAvailablePairs = Object.values(availablePairsByChain).reduce((sum, pairs) => sum + pairs.length, 0);
    if (totalAvailablePairs === 0) {
      throw new Error(`No enabled pairs configured for selected profile "${selectedProfile.id}".`);
    }

    const premiumDecision = resolvePremiumDecision({
      premiumRequested,
      hasAccess,
      reportPersistenceRequested: config.ENABLE_REPORT_PERSISTENCE,
      freeConcurrency: 1,
      premiumConcurrency: selectedProfile.maxConcurrency,
      freeMaxPairs: 1,
      premiumMaxPairs: Math.max(1, totalAvailablePairs),
    });
    const userLoginSignature = (cliArgs.signature ?? config.USER_LOGIN_SIGNATURE)?.trim();

    if (premiumNotice) {
      logger.info({ mode: "free" }, premiumNotice);
    } else if (premiumDecision.premiumActive) {
      logger.info({ mode: "premium", wallet: candidateAddress }, "Premium unlocked: Access Pass verified");
    }

    const cappedConcurrency = Math.max(1, Math.min(premiumDecision.maxConcurrency, config.RPC_MAX_CONCURRENCY));
    let remainingPairBudget = Math.max(1, premiumDecision.maxPairs);
    const scanTasks: Array<{
      chainId: number;
      rpcEndpoint: string;
      provider: RpcProviderClient;
      pairs: PairConfig[];
      quoteSources: IQuoteSource[];
      minProfitGap: number;
      gasPriceGwei: number;
      gasLimit: number;
      maxConcurrency: number;
      blockTag?: number | "latest";
      rpcTimeoutMs?: number;
      rpcRetryMax?: number;
      rpcRetryBackoffMs?: number;
    }> = [];

    for (const chainId of scanChains) {
      if (remainingPairBudget <= 0) {
        break;
      }
      const providerDetails = scanBestByChain[chainId];
      if (!providerDetails) {
        continue;
      }
      const availablePairs = availablePairsByChain[chainId] ?? [];
      if (availablePairs.length === 0) {
        continue;
      }
      const selectedPairs = availablePairs.slice(0, remainingPairBudget);
      remainingPairBudget -= selectedPairs.length;
      if (selectedPairs.length === 0) {
        continue;
      }

      const pairKeys = selectedPairs.map((pair) => toPairKey(pair));
      const quoteSources = buildQuoteSourcesForChain(
        pairKeys,
        providerDetails.provider,
        providerDetails.blockNumber,
        config,
        selectedProfile.quoteSources,
      );
      scanTasks.push({
        chainId,
        rpcEndpoint: providerDetails.endpointName,
        provider: providerDetails.provider,
        pairs: selectedPairs,
        quoteSources,
        minProfitGap: selectedProfile.minProfitGap,
        gasPriceGwei: 20 + ((providerDetails.blockNumber ?? 0) % 7),
        gasLimit: 220000,
        maxConcurrency: cappedConcurrency,
        blockTag: providerDetails.blockNumber ?? "latest",
        rpcTimeoutMs: config.RPC_TIMEOUT_MS,
        rpcRetryMax: config.RPC_RETRY_MAX,
        rpcRetryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
      });
    }

    if (scanTasks.length === 0) {
      const providerErrorSummary = scanProviderErrors.length > 0 ? ` ${scanProviderErrors.join(" | ")}` : "";
      throw new Error(`No scan tasks available for profile "${selectedProfile.id}".${providerErrorSummary}`);
    }

    const scanReport = await runMultiChainScan({ tasks: scanTasks });
    process.stdout.write(`Chains scanned: ${(scanReport.chainIds ?? [scanReport.chainId]).length}\n`);

    const reportHash = computeReportHash(scanReport);
    const enrichedReport = premiumDecision.includeRicherReport
      ? {
          ...scanReport,
          premium: {
            accessBalance,
            accessPass: {
              chainId: accessStatus.chainId,
              tokenId: accessStatus.tokenId,
              minBalance: accessStatus.minBalance,
            },
          },
        }
      : scanReport;

    const freeSummary = buildFreeSummary(scanReport, reportHash, {
      topN: 3,
      premiumAvailable: premiumDecision.premiumActive,
    });
    if (!config.APP_SIGNER_KEY) {
      throw new Error("Missing app signer key. Set PREMIUM_SIGNER_PRIVATE_KEY in local .env.");
    }
    const signedFreeSummary = await signFreeSummary(freeSummary, config.APP_SIGNER_KEY);
    process.stdout.write(`Free summary created for reportHash ${reportHash}\n`);

    let premiumPackage: PremiumPackage | null = null;
    if (premiumDecision.premiumActive) {
      if (!candidateAddress) {
        throw new Error("Premium mode requires --address or USER_WALLET_ADDRESS.");
      }
      if (!userLoginSignature) {
        throw new Error("Premium mode requires --signature or USER_LOGIN_SIGNATURE.");
      }
      if (!config.PREMIUM_SIGNER_KEY) {
        throw new Error("Premium mode requires a local premium signer key in .env (see .env.example).");
      }
      const rateLimitDecision = checkAndConsumePremiumRateLimit({
        walletAddress: candidateAddress,
        maxPackagesPerHour: config.PREMIUM_MAX_PACKAGES_PER_HOUR,
        windowSeconds: config.PREMIUM_RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rateLimitDecision.allowed) {
        logger.warn(
          {
            mode: "premium",
            wallet: candidateAddress,
            resetAt: rateLimitDecision.windowResetAt,
          },
          "Premium rate limit reached",
        );
      } else {
        premiumPackage = await buildPremiumPackage({
          reportObject: {
            reportHash,
            scanReport: enrichedReport,
          },
          reportHash,
          userAddress: candidateAddress,
          chainId: scanReport.chainId,
          ttlSeconds: config.PREMIUM_PACKAGE_TTL_SECONDS,
          version: config.PREMIUM_PACKAGE_VERSION,
          userSignature: userLoginSignature,
          signingKeyHex: config.PREMIUM_SIGNER_KEY,
        });
        process.stdout.write(`Premium package created for reportHash ${reportHash}\n`);
        logger.info(
          { mode: "premium", reportHash, expiresAt: premiumPackage.header.expiresAt, nonce: premiumPackage.header.nonce },
          `Premium package created (encrypted+signed). Expires in ${config.PREMIUM_PACKAGE_TTL_SECONDS}s.`,
        );
      }
    }

    const subscriptions = await listSubscriptions();
    const premiumPackageUrlByAddress: Record<string, string> = {};
    if (premiumPackage && candidateAddress) {
      premiumPackageUrlByAddress[candidateAddress.toLowerCase()] = `/api/premium/${reportHash}/${candidateAddress.toLowerCase()}`;
    }

    const alerts: AlertEvent[] = [];
    const alertBuildErrors: string[] = [];
    let alertPersistence: { jsonlPath: string; latestPath: string } | null = null;
    let alertsSent = 0;
    let alertDeliveryFailures = 0;
    const alertDeliveryErrors: string[] = [];
    const subscriptionAccessErrors: string[] = [];
    let discordResult: DiscordSendResult = {
      status: "skipped",
      sentAt: null,
      reason: operatorMode ? "disabled" : "operator_only",
    };
    let telegramResult: TelegramSendResult = {
      status: "skipped",
      sentAt: null,
      reason: operatorMode ? "disabled" : "operator_only",
    };

    if (subscriptions.length > 0) {
      const alertAccessStatus: AccessStatus = {
        enabled: true,
        chainId: selectedAccessChain,
        contract: selectedAccessContract,
        tokenId: config.ACCESS_PASS_TOKEN_ID,
        minBalance: config.ACCESS_PASS_MIN_BALANCE,
        acceptedChains: acceptedAccessChains,
        contractsByChain: contractByChain,
      };
      const addressModeCache = new Map<string, boolean>();
      let providersByChain: Record<number, RpcProviderClient> = {};
      const canCheckPremiumForAlerts =
        acceptedAccessChains.length > 0 &&
        Object.keys(contractByChain).length > 0;

      if (canCheckPremiumForAlerts) {
        const missingChains = acceptedAccessChains.filter((chainIdEntry) => !accessManagersByChain[chainIdEntry]);
        if (missingChains.length > 0) {
          const managerInit = createAccessPassRpcManagers(config, missingChains);
          subscriptionAccessErrors.push(...managerInit.errors);
          accessManagersByChain = {
            ...accessManagersByChain,
            ...managerInit.managersByChain,
          };
        }
        const providersResult = await getProvidersByChain(accessManagersByChain);
        subscriptionAccessErrors.push(...providersResult.errors);
        providersByChain = providersResult.providersByChain;
      }

      try {
        const reportsForAlerts = scanReport.chainReports && scanReport.chainReports.length > 0
          ? scanReport.chainReports
          : [scanReport];

        for (const chainReport of reportsForAlerts) {
          const alertBuildResult = await buildAlertEvents({
            scanReport: chainReport,
            reportHash,
            subscriptions,
            signedFreeSummaryUrl: "/api/feed/latest",
            premiumPackageUrlByAddress,
            isPremiumAddress: async (address: string): Promise<boolean> => {
              const normalized = address.toLowerCase();
              if (addressModeCache.has(normalized)) {
                return addressModeCache.get(normalized) ?? false;
              }

              if (!canCheckPremiumForAlerts) {
                addressModeCache.set(normalized, false);
                return false;
              }

              const accessResult = await checkAccessPassAcrossChains(providersByChain, address, alertAccessStatus);
              subscriptionAccessErrors.push(...(accessResult.errors ?? []));
              addressModeCache.set(normalized, accessResult.hasAccess);
              return accessResult.hasAccess;
            },
          });
          alerts.push(...alertBuildResult.events);
          alertBuildErrors.push(...alertBuildResult.errors);
        }

        alertPersistence = await persistAlerts(alerts);
        const deliveryResult = await dispatchWebhookAlerts(alerts, {
          timeoutMs: config.RPC_TIMEOUT_MS,
          retryMax: config.RPC_RETRY_MAX,
          retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
        });
        alertsSent = deliveryResult.sent;
        alertDeliveryFailures = deliveryResult.failed;
        alertDeliveryErrors.push(...deliveryResult.errors);
      } catch (error) {
        logger.warn(
          { error: sanitizeErrorMessage(error) },
          "Alert processing failed; continuing without delivery",
        );
      }
    } else {
      alertPersistence = await persistAlerts([]);
    }

    const topAlert = alerts
      .slice()
      .sort((left, right) => right.score - left.score)[0] ?? null;

    if (operatorMode && config.ENABLE_DISCORD_ALERTS) {
      discordResult = await sendDiscordAlert({
        event: topAlert,
        enabled: true,
        botToken: config.DISCORD_BOT_TOKEN,
        channelId: config.DISCORD_CHANNEL_ID,
        minIntervalSeconds: config.DISCORD_ALERTS_MIN_INTERVAL_SECONDS,
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
      });
      if (discordResult.status === "error") {
        logger.warn({ error: discordResult.error }, "Discord alert send failed");
      }
    }

    if (operatorMode && config.ENABLE_TELEGRAM_ALERTS) {
      telegramResult = await sendTelegramAlert({
        event: topAlert,
        enabled: true,
        botToken: config.TELEGRAM_BOT_TOKEN,
        chatId: config.TELEGRAM_CHAT_ID,
        minIntervalSeconds: config.TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS,
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
      });
      if (telegramResult.status === "error") {
        logger.warn({ error: telegramResult.error }, "Telegram alert send failed");
      }
    }

    process.stdout.write(`Alerts sent: ${alertsSent}\n`);
    process.stdout.write(`Discord status: ${discordResult.status}\n`);
    process.stdout.write(`Discord sent at: ${discordResult.sentAt ?? "none"}\n`);
    process.stdout.write(`Telegram status: ${telegramResult.status}\n`);
    process.stdout.write(`Telegram sent at: ${telegramResult.sentAt ?? "none"}\n`);

    let publishResult: PublishResult | null = null;
    if (config.ENABLE_PUBLIC_SUMMARY_PUBLISH) {
      try {
        publishResult = await publishJson(signedFreeSummary, {
          uploadUrl: config.IPFS_UPLOAD_URL,
          authToken: config.IPFS_AUTH_TOKEN,
        });
      } catch (error) {
        logger.warn(
          { error: sanitizeErrorMessage(error) },
          "Public free summary publish failed; continuing without publishing",
        );
      }
    }

    const feedArtifacts = storeSignedFreeSummary(signedFreeSummary);
    let premiumStoragePath: string | null = null;
    if (premiumPackage && candidateAddress) {
      premiumStoragePath = storePremiumPackage(premiumPackage, reportHash, candidateAddress);
    }

    const freeSummaryPath = writeScanReport(signedFreeSummary, {
      enabled: config.ENABLE_REPORT_PERSISTENCE,
      filePrefix: "free-summary-signed",
    });
    const premiumPackageArchivePath = writeScanReport(premiumPackage, {
      enabled: config.ENABLE_REPORT_PERSISTENCE && premiumPackage !== null,
      filePrefix: "premium-package",
    });

    const statusSnapshot = buildStatusSnapshot({
      chainId: scanReport.chainId,
      targetNetwork: config.TARGET_NETWORK,
      operatorEnabled: config.OPERATOR_ENABLE,
      lastTickOk: true,
      lastReportHash: reportHash,
      lastAlertsSent: alertsSent,
      lastDiscordSentAt: discordResult.sentAt,
      lastDiscordStatus: discordResult.status,
      lastTelegramSentAt: telegramResult.sentAt,
      lastTelegramStatus: telegramResult.status,
      premiumModeCapable: Boolean(config.PREMIUM_SIGNER_KEY),
    });

    logger.info(
      {
        mode: "dry-run",
        profile: {
          id: selectedProfile.id,
          sourceProfileId: selectedProfile.sourceProfileId,
          chains: selectedProfile.chains,
          quoteSources: selectedProfile.quoteSources,
          warnings: selectedProfile.warnings,
        },
        chains: (scanReport.chainIds ?? [scanReport.chainId]).map((chainId) => getChainConfig(chainId)),
        rpcEndpoint: scanReport.rpcEndpoint,
        rpcHealth: bestRpc.allHealth,
        scanProviderErrors,
        premium: {
          requested: premiumRequested,
          active: premiumDecision.premiumActive,
          scannedPairs: scanReport.pairsScanned,
          maxConcurrency: cappedConcurrency,
          accessChain: matchedAccessChain,
          accessErrors,
        },
        reportHash,
        scanReport: enrichedReport,
        freeSummary: signedFreeSummary,
        publicSummaryPublication: publishResult,
        feedArtifacts,
        premiumStoragePath,
        alerts: {
          subscriptionsLoaded: subscriptions.length,
          eventsGenerated: alerts.length,
          alertsSent,
          failedDeliveries: alertDeliveryFailures,
          buildErrors: alertBuildErrors,
          deliveryErrors: alertDeliveryErrors,
          accessErrors: subscriptionAccessErrors,
          persistence: alertPersistence,
          discord: discordResult,
          telegram: telegramResult,
        },
        reportPersistenceEnabled: config.ENABLE_REPORT_PERSISTENCE,
        freeSummaryPath,
        premiumPackageArchivePath,
        statusSnapshot,
      },
      "Read-only multi-pair scan report",
    );

    process.stdout.write("Zyntraflow: Securely Linked\n");
  } catch (error) {
    if (error instanceof MissingConfigError) {
      process.stderr.write(
        "Missing .env or required environment variables. Copy .env.example to .env and fill values.\n",
      );
      process.exit(1);
    }

    logger.error({ error: sanitizeErrorMessage(error) }, "RPC connectivity or dry-run scan failed");
    process.stderr.write(`Connection failed: ${sanitizeErrorMessage(error)}\n`);
    process.exit(1);
  } finally {
    rpcManager?.close();
    closeRpcManagers(scanManagersByChain);
    closeRpcManagers(accessManagersByChain);
  }
};

void main();
