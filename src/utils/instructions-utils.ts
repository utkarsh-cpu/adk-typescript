// TODO: Implement
import { ReadonlyContext } from '@/agents';
import { State } from '@/sessions';

export async function injectSessionState(
  template: string,
  readonlycontext: ReadonlyContext
): Promise<string> {
  const invocationContext = readonlycontext._invocationContext;

  // Async regex substitution (sequential, Python-like)
  async function _asyncSub(
    pattern: RegExp | string,
    replAsyncFn: (match: RegExpMatchArray) => Promise<string>,
    input: string
  ): Promise<string> {
    // 1) Normalize the pattern into a global RegExp so we can iterate all matches.
    //    Using matchAll() avoids manual lastIndex management and handles zero-width matches safely.
    const re =
      typeof pattern === 'string'
        ? new RegExp(pattern, 'g')
        : new RegExp(
            pattern.source,
            pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
          );

    // 2) Prepare an array of string chunks; this mirrors the Python `result` list.
    const out: string[] = [];

    // 3) Track the end of the previous match so we can slice the untouched segment before each match.
    let lastEnd = 0;

    // 4) Iterate all matches in order; for each match:
    //    - push the preceding unmatched segment
    //    - await the async replacement
    //    - push the replacement
    //    - update lastEnd
    for (const match of input.matchAll(re)) {
      // match.index is where the current match starts; match[0] is the full match text.
      const start = match.index ?? 0;
      const end = start + match[0].length;

      out.push(input.slice(lastEnd, start));

      const replacement = await replAsyncFn(match);
      out.push(replacement);

      lastEnd = end;
    }

    // 5) Push the trailing unmatched segment after the last match.
    out.push(input.slice(lastEnd));

    // 6) Join all chunks into the final string result.
    return out.join('');
  }
  async function _replaceMatch(match: RegExpMatchArray): Promise<string> {
    let varName = match[0].replace(/^{/, '').replace(/}$/, '').trim();
    let optional = false;
    if (varName.endsWith('?')) {
      optional = true;
      varName = varName.endsWith('?') ? varName.slice(0, -1) : varName;
    }
    if (varName.startsWith('artifact.')) {
      varName = varName.startsWith('artifact.')
        ? varName.slice('artifact.'.length)
        : varName;
      if (invocationContext.artifactService == null) {
        throw Error('Artifact service is not initialized.');
      }
      const artifact = await invocationContext.artifactService.loadArtifact({
        appName: invocationContext.session.appName,
        userId: invocationContext.session.userId,
        sessionId: invocationContext.session.id,
        filename: varName,
      });
      if (artifact == null) {
        if (optional) {
          console.debug(
            'Artifact %s not found, replacing with empty string',
            varName
          );
          return '';
        } else {
          throw Error(`Artifact ${varName} not found.`);
        }
      }
      return artifact.toString();
    } else {
      if (!_isValidStateName(varName)) {
        return match.toString();
      }
      if (varName in invocationContext.session.state) {
        const value = invocationContext.session.state[varName];
        if (value == null) {
          return '';
        }
        return value;
      } else {
        if (optional) {
          console.debug(
            'Context variable %s not found, replacing with empty string',
            varName
          );
          return '';
        } else {
          throw Error(`Context variable not found: ${varName}.`);
        }
      }
    }
  }

  return await _asyncSub(new RegExp('{+[^{}]*}+'), _replaceMatch, template);

  function isIdentifier(name: string): boolean {
    try {
      // A clever way to check validity is to see if a function can be created with the name.
      new Function(`var ${name}`);
      return true;
    } catch {
      return false;
    }
  }
  function _isValidStateName(varName: string): boolean {
    const parts = varName.split(':');
    if (parts.length == 1) {
      return isIdentifier(varName);
    }
    if (parts.length == 2) {
      const prefixes = [State.APP_PREFIX, State.TEMP_PREFIX, State.USER_PREFIX];
      if (`${parts[0]}:` in prefixes) {
        return isIdentifier(parts[1]);
      }
    }
    return false;
  }
}
export class InstructionsUtils {}
