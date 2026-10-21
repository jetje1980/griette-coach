// Bundelt een testbestand met esbuild zodat het in node draait.
// Supabase wordt gestubd: de testen gaan over de logica, niet over het netwerk.
import * as esbuild from 'esbuild';

const entry = process.argv[2];
const out = process.argv[3] || entry.replace(/\.js$/, '.bundle.mjs');

const stub = {
  name: 'stub',
  setup(build) {
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
      path: 'supabase-stub', namespace: 'stub',
    }));
    // React wordt gestubd: de exporteerde rekenfuncties in de componenten
    // (computeNextSession, computeHeadCoach) raken React niet aan, en zo
    // kunnen ze toch in node getest worden.
    build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, () => ({
      path: 'react-stub', namespace: 'reactstub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'reactstub' }, () => ({
      contents: `const h = () => null;
        export const useState = (v) => [v, () => {}];
        export const useMemo = (f) => f();
        export const useEffect = () => {};
        export const useRef = () => ({ current: null });
        export const useCallback = (f) => f;
        export const createElement = h;
        export const Fragment = 'Fragment';
        export const jsx = h;
        export const jsxs = h;
        export const jsxDEV = h;
        export default { useState, useMemo, useEffect, useRef, useCallback,
          createElement, Fragment, jsx: h, jsxs: h };`,
      loader: 'js',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `export function createClient() {
        const q = () => ({ select: a, insert: a, upsert: a, update: a, delete: a, eq: a,
          order: a, limit: a, single: a, maybeSingle: a, then: (f) => Promise.resolve({ data: null, error: null }).then(f) });
        function a() { return q(); }
        return { from: q, auth: { getUser: async () => ({ data: { user: null } }),
          getSession: async () => ({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
          storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } };
      }`,
      loader: 'js',
    }));
  },
};

await esbuild.build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  jsx: 'automatic',
  resolveExtensions: ['.js', '.jsx', '.mjs', '.json'],
  loader: { '.js': 'jsx' },
  plugins: [stub],
  logLevel: 'info',
});
console.log('→', out);
