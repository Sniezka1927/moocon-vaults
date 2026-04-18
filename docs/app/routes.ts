import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/docs.tsx', { id: 'docs-index' }),
  route('api/search', 'routes/search.ts'),
  route('og/docs/*', 'routes/og.docs.tsx'),

  // LLM integration:
  route('llms.txt', 'llms/index.ts'),
  route('llms-full.txt', 'llms/full.ts'),
  route('llms.mdx/docs/*', 'llms/mdx.ts'),

  route('*', 'routes/docs.tsx', { id: 'docs-splat' }),
] satisfies RouteConfig;
