  <script lang="ts">
    import { Button } from '@foxui/core';
    import { atProtoLoginModalState } from '@foxui/social';
    import { user, logout } from '$lib/atproto';
  </script>

  {#if user.isLoggedIn}
    <p>Signed in as {user.profile?.handle ?? user.did}</p>
    <Button onclick={() => logout()}>Sign Out</Button>
  {:else}
    <Button onclick={() => atProtoLoginModalState.show()}>Sign In</Button>
  {/if}