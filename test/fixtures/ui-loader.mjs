export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@clack/prompts') {
    return { url: new URL('./prompts.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
