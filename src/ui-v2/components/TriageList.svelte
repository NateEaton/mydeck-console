<script>
  import { createEventDispatcher } from 'svelte';
  import TriageCard from './TriageCard.svelte';

  export let bookmarks = [];
  export let loading = false;
  export let pendingDeleteId = null;

  const dispatch = createEventDispatcher();

  function onDelete(event) {
    dispatch('delete', event.detail);
  }

  function onSelect(event) {
    dispatch('select', event.detail);
  }
</script>

<div class="list-wrap">
  {#if loading && bookmarks.length === 0}
    <div class="empty">Loading…</div>
  {:else if bookmarks.length === 0}
    <div class="empty">No broken bookmarks found.</div>
  {:else}
    <div class="list">
      {#each bookmarks as b (b.id)}
        <TriageCard
          bookmark={b}
          pendingDelete={pendingDeleteId === b.id}
          on:delete={onDelete}
          on:select={onSelect}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .list-wrap {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
    min-width: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .empty {
    padding: 48px 16px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
