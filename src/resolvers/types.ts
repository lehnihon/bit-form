export interface BitResolverScopeOptions {
  scopeFields?: string[];
}

export interface BitYupResolverConfig {
  abortEarly?: boolean;
  stripUnknown?: boolean;
}

export interface BitJoiResolverConfig {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

export interface BitZodResolverConfig {}
