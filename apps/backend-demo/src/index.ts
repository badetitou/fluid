import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const port = Number(process.env.PORT ?? 4000);

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  },
});

const server = createServer(yoga);

server.listen(port, () => {
  console.log(`🏦  fluid backend-demo ready at http://localhost:${port}/graphql`);
});
