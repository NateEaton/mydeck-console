<script>
  import { createEventDispatcher } from 'svelte';

  export let title = '';

  const dispatch = createEventDispatcher();

  function short(t) {
    if (!t) return 'bookmark';
    return t.length > 28 ? t.slice(0, 27).trimEnd() + '…' : t;
  }

  function onUndo(event) {
    event.stopPropagation();
    dispatch('undo');
  }
</script>

<div class="snackbar" data-delete-snackbar>
  <span class="msg">Deleted <em>{short(title)}</em></span>
  <button class="undo" on:click={onUndo}>Undo</button>
</div>

<style>
  .snackbar {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    min-width: 280px;
    max-width: calc(100% - 32px);
    background: #323232;
    color: #fff;
    border-radius: 8px;
    box-shadow: 0 3px 5px rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.14);
    z-index: 60;
    font-size: 0.9rem;
  }
  .msg em {
    font-style: italic;
    color: #fff;
  }
  .undo {
    background: transparent;
    border: none;
    color: #82b1ff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
  }
  .undo:hover {
    background: rgba(255,255,255,0.08);
  }
</style>
