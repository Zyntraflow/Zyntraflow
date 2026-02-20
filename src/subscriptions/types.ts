export type SubscriptionDelivery = {
  webhookUrl?: string;
};

export type Subscription = {
  version: 1;
  userAddress: string;
  createdAt: number;
  minNetProfitEth: number;
  maxSlippagePercent: number;
  chains: number[];
  pairs?: string[];
  delivery: SubscriptionDelivery;
  nonce: string;
  signature: string;
};

export type SubscriptionUnsigned = Omit<Subscription, "signature">;
