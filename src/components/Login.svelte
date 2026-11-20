<script>
  import { supabase } from '../lib/supabase.js';
  import { APP_NAME } from '../config.js';

  let email = $state(localStorage.getItem('ikh-last-email') || '');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = '';
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    busy = false;
    if (err) error = err.message === 'Invalid login credentials' ? 'Email o password non corretti.' : err.message;
    else localStorage.setItem('ikh-last-email', email.trim());
  }
</script>

<div class="auth-wrap">
  <form class="auth-card" onsubmit={submit}>
    <div class="auth-logo"><img src="./icon.svg" alt="" width="48" height="48" /></div>
    <h1>{APP_NAME}</h1>
    <p class="muted">Il manuale da campo dello studio.</p>
    <label>Email
      <input type="email" bind:value={email} autocomplete="username" required />
    </label>
    <label>Password
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </label>
    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn btn-primary btn-block" disabled={busy}>{busy ? 'Accesso…' : 'Entra'}</button>
    <p class="muted small">Account creati dall'amministratore. Resti collegato su questo dispositivo.</p>
  </form>
</div>
