import { defineConfig } from 'vite';

function githubPagesBase(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return '/';
  const name = repo.split('/')[1];
  return name ? `/${name}/` : '/';
}

export default defineConfig({
  // Ensures correct asset paths when deployed to GitHub Pages under /<repo>/
  base: githubPagesBase(),
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
});
