import { Hono } from 'npm:hono';
import { logger } from 'npm:hono/logger';
import type { Next } from 'npm:hono/types';
import { GetHandler } from './deno/methods/get.ts';
import { PostHandler } from './deno/methods/post.ts';
import 'https://deno.land/x/worker_types@v1.0.0/cloudflare-worker-types.ts';
import { DsDDB } from 'https://deno.land/x/dsddb@v2.1.0/mod.ts';
import { configDotenv } from 'npm:dotenv';

const KVStore = new DsDDB<ArrayBuffer>();
const EmptyArrayBuffer = new ArrayBuffer(0);

const KV = {
	get: async function (Key: string, _Type: 'arrayBuffer'): Promise<ArrayBuffer | undefined> {
		return KVStore.get(Key);
	},
	put: async function (Key: string, Content: ArrayBuffer): Promise<void> {
		KVStore.set(Key, Content);
	},
	delete: function(Key: string) {
		this.put(Key, EmptyArrayBuffer);
	}
};

type Bindings = {
	ApakrFiles: KVNamespace;
};

const App = new Hono<{ Bindings: Bindings }>();

App.use('*', logger());
App.use('*', async function (Context, Next: Next) {
	// @ts-ignore: In-memory map.
	Context.env.ApakrFiles = KV;
	// @ts-ignore: Allows us to save the KV store.
	Context.env.SaveKVStore = KVStore.write;

	await Next();
});

App.get('/', GetHandler);
App.post('/', PostHandler);

KVStore.load().then(function () {
	configDotenv();

	Deno.serve(
		{
			port: parseInt(Deno.env.get('CONTAINER_PORT') || Deno.env.get('DENO_PORT') || '9650'),
			hostname: Deno.env.get('DENO_HOST') || '0.0.0.0',
		},
		App.fetch
	);
});
