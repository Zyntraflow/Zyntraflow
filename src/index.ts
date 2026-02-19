import { getAddress } from "ethers";
import { checkAccessPassAcrossChains } from "./access/accessPass";
import { buildMintInstructions } from "./access/mintInstructions";
import type { AccessStatus } from "./access/types";
import { buildLoginMessage, buildNonce } from "./auth/siwe";
import { MissingConfigError, loadConfig } from "./config";
import { getChainConfig } from "./chains/chains";
import { parseCliArgs } from "./cli/args";
import { logger } from "./logger";
import { buildPremiumPackage } from "./premium/packageBuilder";
import type { PremiumPackage } from "./premium/packageTypes";
import { storePremiumPackage, storeSignedFreeSummary } from "./premium/packageStorage";
import { getEnabledPairsForChain } from "./pairs/pairs";
import { resolvePremiumDecision } from "./premium/premiumGating";
import { checkAndConsumePremiumRateLimit } from "./premium/rateLimit";
import { publishJson, type PublishResult } from "./publishing/ipfsPublisher";
import { MockQuoteSource } from "./quotes/mockQuoteSource";
import { UniswapV2QuoteSource } from "./quotes/uniswapV2QuoteSource";
import { buildFreeSummary } from "./reporting/freeSummary";
import { signFreeSummary } from "./reporting/freeSummarySigned";
import { computeReportHash } from "./reporting/reportHash";
import { writeScanReport } from "./reporting/reportWriter";
import { buildStatusSnapshot } from "./reporting/statusSnapshot";
import { loadRpcEndpoints } from "./rpc/endpoints";
import { RpcManager } from "./rpc/manager";
import { closeRpcManagers, createAccessPassRpcManagers, getProvidersByChain } from "./rpc/multiChain";
import { runScan } from "./scanner/scanEngine";

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

const main = async (): Promise<void> => {
  let rpcManager: RpcManager | null = null;
  let accessManagersByChain: Record<number, RpcManager> = {};

  try {
    const cliArgs = parseCliArgs();
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
    const chainId = config.CHAIN_ID ?? bestRpc.health.chainId ?? detectedChainId;
    const chain = getChainConfig(chainId);
    const pairs = getEnabledPairsForChain(chainId);
    if (pairs.length === 0) {
      throw new Error(`No enabled pairs configured for chainId ${chainId}.`);
    }

    const premiumRequested = cliArgs.premiumOverride ?? config.ENABLE_PREMIUM_MODE;
    const candidateAddress = normalizeAddress(cliArgs.address ?? config.USER_WALLET_ADDRESS);
    const acceptedAccessChains =
      config.ACCESS_PASS_ACCEPTED_CHAINS.length > 0
        ? config.ACCESS_PASS_ACCEPTED_CHAINS
        : [config.ACCESS_PASS_CHAIN_ID ?? chainId];
    const contractByChain = {
      ...config.ACCESS_PASS_CONTRACTS_BY_CHAIN,
    };
    if (config.ACCESS_PASS_CHAIN_ID && config.ACCESS_PASS_CONTRACT_ADDRESS) {
      contractByChain[config.ACCESS_PASS_CHAIN_ID] = config.ACCESS_PASS_CONTRACT_ADDRESS;
    }
    const selectedAccessChain = config.ACCESS_PASS_CHAIN_ID ?? acceptedAccessChains[0] ?? chainId;
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

    const premiumDecision = resolvePremiumDecision({
      premiumRequested,
      hasAccess,
      reportPersistenceRequested: config.ENABLE_REPORT_PERSISTENCE,
      freeConcurrency: 2,
      premiumConcurrency: 5,
      freeMaxPairs: 1,
      premiumMaxPairs: pairs.length,
    });
    const userLoginSignature = (cliArgs.signature ?? config.USER_LOGIN_SIGNATURE)?.trim();

    const pairsToScan = pairs.slice(0, premiumDecision.maxPairs);

    if (premiumNotice) {
      logger.info({ mode: "free" }, premiumNotice);
    } else if (premiumDecision.premiumActive) {
      logger.info({ mode: "premium", wallet: candidateAddress }, "Premium unlocked: Access Pass verified");
    }

    const mockPrices = Object.fromEntries(
      pairsToScan.map((pair) => {
        const key = `${pair.base.symbol}/${pair.quote.symbol}`;
        const basePrice = pair.quote.symbol === "USDC" || pair.quote.symbol === "DAI" ? 3000 : 1;
        return [key, basePrice];
      }),
    );

    const quoteSources = [
      new MockQuoteSource({
        prices: mockPrices,
        fixedBlockNumber: bestRpc.health.blockNumber ?? undefined,
      }),
      new UniswapV2QuoteSource(provider, {
        timeoutMs: config.RPC_TIMEOUT_MS,
        retryMax: config.RPC_RETRY_MAX,
        retryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
        retryJitterMs: Math.min(config.OPERATOR_JITTER_MS, 1000),
      }),
    ];

    const cappedConcurrency = Math.max(
      1,
      Math.min(premiumDecision.maxConcurrency, config.RPC_MAX_CONCURRENCY),
    );

    const scanReport = await runScan({
      provider,
      chainId,
      rpcEndpoint: bestRpc.endpoint.name,
      pairs: pairsToScan,
      quoteSources,
      minProfitGap: config.MIN_PROFIT_GAP,
      gasPriceGwei: 20 + ((bestRpc.health.blockNumber ?? 0) % 7),
      gasLimit: 220000,
      maxConcurrency: cappedConcurrency,
      blockTag: bestRpc.health.blockNumber ?? "latest",
      rpcTimeoutMs: config.RPC_TIMEOUT_MS,
      rpcRetryMax: config.RPC_RETRY_MAX,
      rpcRetryBackoffMs: config.RPC_RETRY_BACKOFF_MS,
    });

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
          chainId,
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
      chainId,
      targetNetwork: config.TARGET_NETWORK,
      operatorEnabled: config.OPERATOR_ENABLE,
      lastTickOk: true,
      lastReportHash: reportHash,
      premiumModeCapable: Boolean(config.PREMIUM_SIGNER_KEY),
    });

    logger.info(
      {
        mode: "dry-run",
        chain,
        rpcEndpoint: bestRpc.endpoint.name,
        rpcHealth: bestRpc.allHealth,
        premium: {
          requested: premiumRequested,
          active: premiumDecision.premiumActive,
          scannedPairs: pairsToScan.length,
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
    closeRpcManagers(accessManagersByChain);
  }
};

void main();
