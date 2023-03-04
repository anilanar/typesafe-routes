import { stringify } from "qs";
import { Parser } from "./parser";

type If<C, T, E> = C extends true ? (true extends C ? T : E) : E;

interface ParamNames<R extends string = string, O extends string = string> {
  required: R;
  optional: O;
}

type WithOptionalParam<PG extends ParamNames, P extends string> = ParamNames<
  PG["required"],
  PG["optional"] | P
>;
type WithRequiredParam<PG extends ParamNames, P extends string> = ParamNames<
  PG["required"] | P,
  PG["optional"]
>;

export type InferParam<
  T extends string,
  PG extends ParamNames
> = T extends `:${infer P}?`
  ? WithOptionalParam<PG, P>
  : T extends `:${infer P}*`
  ? WithOptionalParam<PG, P>
  : T extends `:${infer P}+`
  ? WithRequiredParam<PG, P>
  : T extends `:${infer P}`
  ? WithRequiredParam<PG, P>
  : PG;

export type InferParamFromPath<P extends string> =
  P extends `${infer A}/${infer B}`
    ? InferParam<A, InferParamFromPath<B>>
    : InferParam<P, { required: never; optional: never }>;

export type AllParamNames<G extends ParamNames> = G["required"] | G["optional"];

type SerializedParams<K extends string = string> = Record<K, string>;

type RawParams = Record<string, unknown>;

type ChildrenMap = Record<string, RouteNode<any, any, any, any>>;

type ParserMap<K extends string> = Record<K, Parser<any>>;

export type ParserReturnType<P extends ParserMap<any>> = {
  [K in keyof P]: P[K] extends Parser<infer R> ? R : never;
};

export type ExtractParserReturnTypes<
  P extends ParserMap<any>,
  F extends keyof P
> = {
  [K in F]: P[K]["_A"];
};

export type ExtractQueryParamsReturnTypes<QP extends ParserMap<string>> = {
  [K in keyof QP as undefined extends QP[K]["_A"] ? K : never]?: QP[K]["_A"];
} & {
  [K in keyof QP as undefined extends QP[K]["_A"] ? never : K]: QP[K]["_A"];
};

export type SerializedQueryParams<QP extends ParserMap<string>> = {
  [K in keyof QP as undefined extends QP[K]["_A"] ? K : never]?: string;
} & {
  [K in keyof QP as undefined extends QP[K]["_A"] ? never : K]: string;
};

interface RouteFnContext {
  previousQueryParams?: SerializedParams;
  previousPath?: string;
}

type Options<
  T extends string, // extending string here ensures successful literal inference
  PM extends ParserMap<AllParamNames<InferParamFromPath<T>>>,
  QP extends ParserMap<string>,
  C extends ChildrenMap
> = {
  template: T;
  parserMap?: PM;
  queryParamsParserMap?: QP;
  stringifyQueryParams?: (qp: ParserReturnType<QP>) => string;
  children?: C;
} & (AllParamNames<InferParamFromPath<T>> extends never
  ? {}
  : { parserMap: PM });

type RouteFn<IS_RECURSIVE = false> = <
  T extends string, // extending string here ensures successful literal inference
  PM extends ParserMap<AllParamNames<InferParamFromPath<T>>>,
  QP extends ParserMap<string>,
  C extends ChildrenMap
>(
  options: Options<T, PM, QP, C>
) => RouteNode<T, PM, QP, C, IS_RECURSIVE>;

export type RouteNode<
  T extends string,
  PM extends ParserMap<AllParamNames<InferParamFromPath<T>>>,
  QP extends ParserMap<string>,
  C extends ChildrenMap,
  IS_RECURSIVE = false
> = {
  parseParams: <G extends InferParamFromPath<T>>(
    params: SerializedParams<G["required"]> &
      Partial<SerializedParams<G["optional"]>> &
      SerializedQueryParams<QP>,
  ) => ExtractParserReturnTypes<PM, G["required"]> &
    Partial<ExtractParserReturnTypes<PM, G["optional"]>> &
    ExtractQueryParamsReturnTypes<QP>;
  template: T;
  children: C;
  parserMap: PM;
  queryParamsParserMap: QP;
  stringifyQueryParams: (qp: ParserReturnType<QP>) => string;
} & (<G extends InferParamFromPath<T>>(
  params: ExtractParserReturnTypes<PM, G["required"]> &
    Partial<ExtractParserReturnTypes<PM, G["optional"]>> &
    ExtractQueryParamsReturnTypes<QP>
) => {
  $: string;
} & {
  [K in keyof C]: C[K];
} & If<IS_RECURSIVE, { $self: RouteNode<T, PM, QP, C, true> }, {}>);

type PathToken = string | PathParam;

interface PathParam {
  modifier: "" | "*" | "+" | "?";
  name: string;
}

const isPathParam = (x: PathToken): x is PathParam => typeof x !== "string";

const filterParserMap = (
  parserMap: ParserMap<any>,
  tokens: PathToken[]
): ParserMap<any> =>
  tokens.reduce<ParserMap<any>>(
    (acc, t: PathToken) =>
      // It is safe to access parserMap[t.name] because types guarantee
      // each token to have a parser.
      !isPathParam(t) ? acc : { ...acc, [t.name]: parserMap[t.name]! },
    {}
  );

type ParsedRouteMeta = ReturnType<typeof parseRoute>;

const parseRoute = (
  path: string,
  parserMap: ParserMap<any>,
  queryParamsParserMap: ParserMap<any>
) => {
  const pathTokens = parseTokens(path.split("/"));
  const pathParamParsers = filterParserMap(parserMap, pathTokens);
  return {
    pathTokens,
    pathParamParsers,
    parserMap,
    queryParamsParserMap,
  };
};

const parseTokens = (path: string[]): PathToken[] =>
  path.reduce<PathToken[]>((acc, f) => {
    if (!f) {
      return acc;
    } else if (f.startsWith(":")) {
      const maybeMod = f[f.length - 1];
      const modifier =
        maybeMod === "+" || maybeMod === "*" || maybeMod === "?"
          ? maybeMod
          : "";
      return acc.concat({
        modifier,
        name: f.slice(1, modifier ? f.length - 1 : undefined),
      });
    }
    return acc.concat(f);
  }, []);

const stringifyParams = (
  parserMap: ParserMap<any>,
  params: RawParams
): Record<string, string> =>
  Object.keys(parserMap).reduce((acc, k) => {
    const param = parserMap[k]!.encode(params[k]);
    return {
      ...acc,
      ...(param.tag === "some" ? { [k]: param.value } : {}),
    };
  }, {});

export function routeFn<
  T extends string, // extending string here ensures successful literal inference
  PM extends ParserMap<AllParamNames<InferParamFromPath<T>>>,
  QP extends ParserMap<string>,
  C extends ChildrenMap
>(
  this: RouteFnContext,
  options: Options<T, PM, QP, C>
): RouteNode<T, PM, QP, C> {
  const parsedRoute = parseRoute(
    options.template,
    options.parserMap ?? {},
    options.queryParamsParserMap ?? {}
  );
  const fn: RouteNode<T, PM, QP, C> = (rawParams: RawParams) =>
    new Proxy<any>(
      {},
      {
        get: (target, next, receiver) => {
          const context = this ?? undefined;
          const pathParams = stringifyParams(
            parsedRoute.pathParamParsers,
            rawParams
          );
          const queryParams: SerializedParams = {
            ...context?.previousQueryParams,
            ...stringifyParams(options.queryParamsParserMap ?? {}, rawParams),
          };
          const isRoot = options.template[0] === "/" && !context?.previousPath;
          const path = stringifyRoute(
            isRoot,
            parsedRoute.pathTokens,
            pathParams,
            context?.previousPath
          );
          if (next === "$") {
            const qs = (options.stringifyQueryParams ?? stringifyQueryParams)(
              queryParams as any
            );
            return qs.length > 0 ? `${path}?${qs}` : path;
          }
          if (next === "$self") {
            return route.call(
              {
                previousPath: path,
                previousQueryParams: queryParams,
              },
              {
                template: options.template,
                parserMap: options.parserMap,
                queryParamsParserMap: options.queryParamsParserMap,
                stringifyQueryParams: options.stringifyQueryParams as any,
                children: options.children,
              }
            );
          }
          if (next === Symbol.toPrimitive) {
            return () =>
              path + stringify(queryParams, { addQueryPrefix: true });
          }
          if (
            typeof next == "string" &&
            options.children &&
            options.children[next]
          ) {
            return route.call(
              {
                previousPath: path,
                previousQueryParams: queryParams,
              },
              {
                template: options.children[next]!.template,
                parserMap: options.children[next]!.parserMap,
                queryParamsParserMap:
                  options.children[next]!.queryParamsParserMap,
                stringifyQueryParams:
                  options.children[next]!.stringifyQueryParams,
                children: options.children[next]!.children,
              }
            );
          }
          return Reflect.get(target, next, receiver);
        },
      }
    );

  fn.parseParams = paramsParser(parsedRoute) as any;
  fn.template = options.template;
  fn.children = options.children ?? ({} as any);
  fn.parserMap = options.parserMap ?? ({} as any);
  fn.queryParamsParserMap = options.queryParamsParserMap ?? ({} as any);
  fn.stringifyQueryParams =
    options.stringifyQueryParams ?? (stringifyQueryParams as any);

  return fn;
}

export const route: RouteFn = routeFn;

export const recursiveRoute: RouteFn<true> = routeFn as RouteFn<true>;

const stringifyRoute = (
  isRoot: boolean,
  pathTokens: PathToken[],
  params: SerializedParams,
  prefixPath = ""
): string =>
  (isRoot ? "/" : "") +
  (prefixPath ? (prefixPath === "/" ? [""] : [prefixPath]) : [])
    .concat(
      pathTokens.reduce<string[]>((acc, t) => {
        return isPathParam(t)
          ? params[t.name]
            ? acc.concat(encodeURIComponent(params[t.name]!))
            : acc
          : acc.concat(t);
      }, [])
    )
    .join("/");

const parseParam = <K extends string>(
  param: K,
  parserMap: ParserMap<any>,
  value: string
): RawParams => {
  const parser = parserMap[param];
  if (parser === undefined) {
    return {};
  }
  const result = parser.decode(value);

  if (result.tag === "none") {
    return {};
  }

  return {
    [param]: result.value,
  };
};

const paramsParser =
  ({ parserMap, queryParamsParserMap }: ParsedRouteMeta) =>
  (params: SerializedParams): RawParams => {
    const parsedParams = Object.keys(params).reduce<RawParams>(
      (acc, k) => ({
        ...acc,
        ...parseParam(k, parserMap, params[k]!),
        ...parseParam(k, queryParamsParserMap, params[k]!),
      }),
      {}
    );
    return parsedParams;
  };

const stringifyQueryParams = (qs: Record<string, string>) =>
  new URLSearchParams(qs).toString();
