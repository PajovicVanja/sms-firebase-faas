export function registerGraphiqlRoutes(app) {
  app.get('/graphiql', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>GraphiQL</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css"/>
    <style>body,html,#graphiql{height:100%;margin:0}</style>
  </head>
  <body>
    <div id="graphiql">Loading...</div>
    <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/graphiql/graphiql.min.js"></script>
    <script>
      const graphQLFetcher = graphQLParams =>
        fetch('./graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graphQLParams),
          credentials: 'omit',
        }).then(r => r.json());
      ReactDOM.render(
        React.createElement(GraphiQL, { fetcher: graphQLFetcher }),
        document.getElementById('graphiql'),
      );
    </script>
  </body>
</html>`);
  });
}
