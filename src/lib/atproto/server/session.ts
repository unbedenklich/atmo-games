import type { Cookies } from '@sveltejs/kit';
import { Client } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { OAuthSession } from '@atcute/oauth-node-client';
import {
	TokenInvalidError,
	TokenRevokedError,
	TokenRefreshError,
	AuthMethodUnsatisfiableError
} from '@atcute/oauth-node-client';
import { createOAuthClient } from './oauth';
import { getSignedCookie } from './signed-cookie';

export type SessionLocals = {
	session: OAuthSession | null;
	client: Client | null;
	did: Did | null;
};

export async function restoreSession(
	cookies: Cookies,
	env?: App.Platform['env']
): Promise<SessionLocals> {
	const did = getSignedCookie(cookies, 'did') as Did | null;

	if (!did) {
		return { session: null, client: null, did: null };
	}

	try {
		const oauth = createOAuthClient(env);
		const session = await oauth.restore(did);

		return {
			session,
			client: new Client({ handler: session }),
			did
		};
	} catch (e) {
		console.error('Failed to restore session:', e);

		const isSessionGone =
			e instanceof TokenInvalidError ||
			e instanceof TokenRevokedError ||
			e instanceof TokenRefreshError ||
			e instanceof AuthMethodUnsatisfiableError;

		if (isSessionGone) {
			cookies.delete('did', { path: '/' });
		}

		return { session: null, client: null, did: null };
	}
}
