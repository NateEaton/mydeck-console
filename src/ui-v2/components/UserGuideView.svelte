<script>
  import guideMarkdown from '../../../docs/user-guide.md?raw';
  import { markdownToHtml } from '../../lib/markdown.js';

  const guideHtml = markdownToHtml(guideMarkdown);
</script>

<div class="guide-wrap">
  <article class="guide-card markdown">
    {@html guideHtml}
  </article>
</div>

<style>
  .guide-wrap {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
    min-width: 0;
  }

  .guide-card {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 20px 22px;
    color: var(--md-sys-color-on-surface);
  }

  .markdown :global(h1) {
    margin: 0 0 12px;
    font-size: 1.35rem;
    line-height: 1.3;
  }

  .markdown :global(h2) {
    margin: 22px 0 10px;
    font-size: 1.03rem;
    line-height: 1.35;
  }

  .markdown :global(h3) {
    margin: 18px 0 8px;
    font-size: 0.95rem;
    line-height: 1.35;
  }

  .markdown :global(p) {
    margin: 0 0 10px;
    line-height: 1.5;
    color: var(--md-sys-color-on-surface);
  }

  .markdown :global(ul),
  .markdown :global(ol) {
    margin: 0 0 12px 18px;
    padding: 0;
  }

  .markdown :global(li) {
    margin: 0 0 6px;
    line-height: 1.45;
  }

  .markdown :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.84em;
    background: var(--md-sys-color-surface-variant);
    padding: 1px 5px;
    border-radius: 6px;
  }

  .markdown :global(pre) {
    margin: 0 0 12px;
    padding: 12px;
    border-radius: 10px;
    background: var(--md-sys-color-surface-variant);
    overflow: auto;
  }

  .markdown :global(pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
  }

  .markdown :global(a) {
    color: var(--md-sys-color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
