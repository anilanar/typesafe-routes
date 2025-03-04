<img title="logo" src="logo.png" />

# WIP

This is a hard-fork from [typesafe-routes](https://github.com/kruschid/typesafe-routes). Will update documentation as time allows.


# Typesafe Routes

Spices up your favorite routing library by adding type-safety to plain string-based route definitions. Let typescript handle the detection of broken links in compilation time while you create maintainable software products.

You can use this utility with your favorite framework that follows [path-to-regex](https://github.com/pillarjs/path-to-regexp) syntax (although we only support a subset of it). You can find some demo applications with [react-router](https://reacttraining.com/react-router/) or [express](https://expressjs.com/) in `src/demo`.

**Typesafe Routes utilizes [Template Literal Types](https://devblogs.microsoft.com/typescript/announcing-typescript-4-1-beta/#template-literal-types) and [Recursive Conditional Types](https://devblogs.microsoft.com/typescript/announcing-typescript-4-1-beta/#recursive-conditional-types). These features are only available in [typescript version 4.1](https://github.com/microsoft/TypeScript/issues/40124) and above.**

## Installation (npm/yarn examples)

``` sh
npm i typesafe-routes

# or

yarn add typesafe-routes
```

## Usage

![example](assets/usage.gif)

### `route(path: string, parserMap: Record<string, Parser>, children: Record<string, ChildRoute>)`

* `path` the path following the `path-to-regex` syntax.
* `parserMap` contains parameter-specific `Parser` identified by parameter name
* `children` assigns route children for nested routes

## Examples

<details>
  <summary>Basic Example</summary>

  ``` ts
  import { route, stringParser } from "typesafe-routes";

  const accountRoute = route("/account/:accountId", {
    accountId: stringParser, // parser implicitly defines the type (string) of 'accountId'
  }, {});

  // serialisation:
  accountRoute({ accountId: "5c9f1e79e96c" }).$
  // => "/account/5c9f1e79e96c"

  // parsing:
  accountRoute.parseParams({ accountId: "123"}).$
  // => { accountId: "123" }
  ```

  While `stringParser` is probably the most common parser/serializer there are also `intParser`, `floatParser`, `dateParser`, and `booleanParser` shipped with the module. But you are not limited to these. If you wish to implement your custom parserserializer just imlement the interface `Parser<T>`. You can find more details on that topic further down the page.
</details>

<details>
  <summary>Nested Routes</summary>
  
  ``` ts
  import { route } from "typesafe-routes";

  const detailsRoute = route("details", {}, {})
  const settingsRoute = route("settings", {}, { detailsRoute });
  const accountRoute = route("/account", {}, { settingsRoute });

  accountRoute({}).settingsRoute({}).detailsRoute({}).$
  // => "/account/settings/details"
  ```
</details>

<details>
  <summary>Absolute & Relative Routes</summary>

  ``` ts
  import { route } from "typesafe-routes";

  const invoice = route(":invoiceId", { invoiceId: intParser }, {});

  const invoices = route("invoices", {}, { invoice });

  const sales = route("sales", {}, { invoices });

  const home = route("/", {}, { sales }); // root route prefixed with a "/"

  // absolute routes:
  home({}).sales({}).invoices({}).invoice({invoiceId: 1234}).$ // => "/sales/invoices/1234"
  home({}).sales({}).invoices({}).$ // => "/sales/invoices"
  home({}).sales({}).$ // => "/sales"
  home({}).$ // => "/"

  // relative routes
  sales({}).invoices({}).invoice({invoiceId: 5678}).$ // => "sales/invoices/5678"
  invoices({}).invoice({invoiceId: 8765}).$ // => "invoices/8765"
  invoice({invoiceId: 4321}).$ // => "4321"

  ```
</details>

<details>
  <summary>Optional Parameters</summary>

  Parameters can be suffixed with a question mark (?) to make a parameter optional.

  ``` ts
  import { route, intParser } from "typesafe-routes";

  const userRoute = route("/user/:userId/:groupId?", {
    userId: intParser,
    groupId: intParser // parser is required also required for optional parameters
  }, {});

  userRoute({ userId: 342 }).$ // groupId is optional
  // => "/user/342"
  userRoute({ userId: 5453, groupId: 5464 }).$
  // => "/user/5453/5464"
  userRoute({ groupId: 464 }).$
  // => error because userId is missing

  // parsing:
  userRoute.parseParams({ userId: "65", groupId: "212" });
  // returns { userId: 6, groupId: 12 }
  ```

</details>

<details>
  <summary>Query Parameters</summary>

  Parameters can be prefixed with `&` to make the parameter a query parameter.

  ``` ts
  import { route, intParser } from "typesafe-routes";

  const usersRoute = route("/users&:start&:limit", {
    start: intParser,
    limit: intParser,
  }, {});

  usersRoute({ start: 10, limit: 20 }).$
  // returns "/users?start=10&limit=20"
  ```

  When serialising nested routes the query params of a parent route are always being appended to the end of the locator string.

  ``` ts
  import { route, intParser } from "typesafe-routes";

  const settingsRoute = route("/settings&:expertMode", {
    expertMode: booleanParser,
  }, {});

  const usersRoute = route("/users&:start&:limit", {
    start: intParser,
    limit: intParser,
  }, {
    settingsRoute
  });

  usersRoute({ start: 10, limit: 20 }).settingsRoute({ expertMode: true })$
  // returns "/users/settings?expertMode=true&start=10&limit=20"

  userRoute.parseParams({ start: "10", limit: "20", expertMode: "false" });
  // returns { start: 10, limit: 20, expertMode: false }
  ```

</details>

<details>
  <summary>Parsers &amp; Serializers</summary>

  If you need to parse/serialize other datatypes than primitive types or dates or the build-in parsers don't meet your requirements for some reason you can create your own parsers with a few lines of code. The `Parser<T>` interface that helps yo to achieve that is defined as followed:

  ``` ts
  interface Parser<T> {
    parse: (s: string) => T;
    serialize: (x: T) => string;
  }
  ```

  The next example shows the implementation and usage of a typesafe `Vector2D` parser/serializer.

  ``` ts
  import { Parser, route } from "typesafe-routes";

  interface Vector2D {
    x: number;
    y: number;
  };

  const vectorParser: Parser<Vector2D> = {
    serialize: (v) => btoa(JSON.stringify(v)),
    parse: (s) => JSON.parse(atob(s)),
  };

  const mapRoute = route("/map&:pos", { pos: vectorParser }, {});

  mapRoute({ pos: { x: 1, y: 0 }}).$;
  // returns "/map?pos=eyJ4IjoxLCJ5IjowfQ%3D%3D"

  vectorParser.parseParams({pos: "eyJ4IjoxLCJ5IjowfQ=="})
  // returns { pos: { x: 1, y: 0 }}
  ```

</details>

<details>
  <summary>React Router Utilities</summary>

  #### `useRouteParams(route: RouteNode)`

  Internally `useRouteParams` depends on `useParams` that will be imported from the optional dependency `react-router-dom`. However unlike `useParams` the `useRouteParams` function is able to parse query strings by utilising [`qs`](github.com/ljharb/qs).

  ``` ts
  import { route, useRouteParams } from "typesafe-routes";

  const topicRoute = route("/:topicId&:limit?", {
    topicId: stringParser,
    limit: floatParser,
  }, {});

  const Component = () => {
    const { topicId, limit } = useRouteParams(topicRoute);

    return <>{...}</>;
  }
  ```

  #### `<Link>` and `<NavLink>`

  Same as the original `<Link>` and `<NavLink>` from `react-router-dom` but require the `to` property to be a route:

  ``` ts
  import { route, Link, NavLink } from "typesafe-routes";

  const topicRoute = route("/topic", {}, {});

  <Link to={topicRoute({})}>Topic</Link>
  <NavLink to={topicRoute({})}>Topic</NavLink>

  <Link to="/topic">Topic</Link> // error "to" prop can't be string 
  <NavLink to="/topic">Topic</NavLink> // error "to" prop can't be string 
  ```

  #### `template`

  `typesafe-routes` implements a subset of template syntax of `react-router` and thus is compatible with it. But since specifying additional query params would break the compatibility (`react-router` doesn't understand the `&` prefix) the `.template` property doesn't contain any of such parameters and can be used to define router in your `react-router` app:

  ``` ts
  import { route } from "typesafe-routes";

  const topicRoute = route("/:topicId&:limit?", {
    topicId: stringParser,
    limit: floatParser,
  }, {});

  <Route path={topicRoute.template}> // template only contains the "/:topicId" path
    <Topic />
  </Route>
  ```

</details>

---

## Developer Fuel

You can have some impact and improve the quality of this project not only by opening issues and opening PRs but also by buying me a cup of fresh coffee as a small reward for my effort. ¡Gracias!

<a href="https://www.buymeacoffee.com/kruschid" target="_blank"><img width="200px" src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me A Coffee" ></a>

## Roadmap

So far I consider this library feature-complete that's why I will be mainly concerned about fixing bugs and improving the API. However, if some high demand for additional functionality or PRs shows up I might be considering expanding the scope.
