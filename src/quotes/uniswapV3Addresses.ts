export type UniswapV3Deployment = {
  quoterV2: string;
  factory?: string;
  router?: string;
};

export const UNISWAP_V3_BY_CHAIN: Record<number, UniswapV3Deployment> = {
  8453: {
    quoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
  },
  42161: {
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  },
};
