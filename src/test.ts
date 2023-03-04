import test from "tape";
import {
  booleanParser,
  dateParser,
  intParser,
  recursiveRoute,
  route,
  stringParser,
  optional,
  ExtractQueryParamsReturnTypes,
  Parser,
} from ".";

test("commonjs imports in strict mode", (t) => {
  // https://github.com/kruschid/typesafe-routes/issues/3
  t.plan(2);

  const { route: routeCJS } = require(".");
  t.equal(
    routeCJS({
      template: "/root",
    })({}).$,
    "/root"
  );
  t.equal(
    require(".").route({
      template: "/root",
    })({}).$,
    "/root"
  );
});

test("absolute & relative routes", (t) => {
  t.plan(5);

  const rootRoute = route({
    template: "/",
  });
  t.equal(rootRoute({}).$, "/");

  const absRoute = route({
    template: "/abs",
  });
  t.equal(absRoute({}).$, "/abs");

  const absRouteWithChild = route({
    template: "/parent",
    children: { child: absRoute },
  });
  t.equal(absRouteWithChild({}).child({}).$, "/parent/abs");

  const relRoute = route({
    template: "child",
  });
  t.equal(relRoute({}).$, "child");

  const relRouteWithChild = route({
    template: "parent",
    children: { child: relRoute },
  });
  t.equal(relRouteWithChild({}).child({}).$, "parent/child");
});

test("nested routes", (t) => {
  t.plan(3);

  const accountRoute = route({ template: "account" });
  const settingsRoute = route({
    template: "settings/:settingsId",
    parserMap: { settingsId: stringParser },
    children: { accountRoute },
  });
  const groupRoute = route({
    template: "/group/:groupId?",
    parserMap: {
      groupId: stringParser,
    },
    queryParamsParserMap: {
      filter: optional(booleanParser),
      limit: intParser,
    },
    children: {
      settingsRoute,
    },
  });

  t.equal(
    groupRoute({ filter: true, limit: 20, groupId: "groupId" })
      .settingsRoute({ settingsId: "settingsId" })
      .accountRoute({}).$,
    "/group/groupId/settings/settingsId/account?filter=true&limit=20",
    "should match nested route"
  );

  t.equal(
    groupRoute({ limit: 30 })
      .settingsRoute({ settingsId: "settingsId" })
      .accountRoute({}).$,
    "/group/settings/settingsId/account?limit=30",
    "should respect optional params"
  );

  const rootRoute = route({
    template: "/",
    children: { account: accountRoute },
  });
  t.equal(rootRoute({}).account({}).$, "/account");
});

test("recursive routes", (t) => {
  t.plan(1);

  const nodeRoute = recursiveRoute({
    template: "/node/:nodeId",
    parserMap: { nodeId: intParser },
  });

  t.equal(
    nodeRoute({ nodeId: 1 })
      .$self({ nodeId: 2 })
      .$self({ nodeId: 3 })
      .$self({ nodeId: 4 }).$,
    "/node/1/node/2/node/3/node/4",
    "should match recursive route"
  );
});

test("param parser", (t) => {
  t.plan(3);

  const groupRoute = route({
    template: "group/:groupId?",
    parserMap: {
      groupId: stringParser,
    },
    queryParamsParserMap: {
      filter: optional(booleanParser),
      limit: intParser,
      date: optional(dateParser),
    },
  });

  t.deepEqual(
    groupRoute.parseParams({
      limit: "99",
      filter: "true",
      groupId: "abc",
      date: "2020-10-02T10:29:50Z",
    }),
    {
      limit: 99,
      filter: true,
      groupId: "abc",
      date: new Date("2020-10-02T10:29:50Z"),
    },
    "should parse params"
  );

  t.deepEqual(
    groupRoute.parseParams({ limit: "9" }),
    { limit: 9 },
    "should skip optional params"
  );

  t.deepEqual(
    groupRoute.parseParams({ limit: "9", extra: 1 } as any),
    { limit: 9 },
    "should not throw if additional params were provided"
  );
});

test("template", (t) => {
  t.plan(1);

  const settingsRoute = route({
    template: "settings/:settingsId",
    parserMap: { settingsId: stringParser },
  });
  const groupRoute = route({
    template: "group/:groupId?",
    parserMap: {
      groupId: stringParser,
    },
    queryParamsParserMap: {
      filter: optional(booleanParser),
      limit: intParser,
    },
    children: {
      settingsRoute,
    },
  });

  t.deepEqual(
    [settingsRoute.template, groupRoute.template],
    ["settings/:settingsId", "group/:groupId?"],
    "should match templates"
  );
});
