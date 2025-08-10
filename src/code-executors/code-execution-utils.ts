import { Part, Content } from '@google/genai';

export class File {
  public readonly name: string;
  public readonly content: string;
  public readonly mimeType: string;
  constructor(name: string, content: string, mimeType: string = 'text/plain') {
    this.name = name;
    this.content = content;
    this.mimeType = mimeType;

    // Freeze the instance to prevent runtime mutations
    Object.freeze(this);
  }
}

export class CodeExecutionInput {
  code: string;
  inputFiles: File[];
  executionId: string | null;

  constructor(code: string, inputFiles: File[] = [], executionId: string) {
    this.code = code;
    this.inputFiles = [...inputFiles];
    this.executionId = executionId;
  }
}

export class CodeExecutionResult {
  public stdout: string;

  public stderr: string;

  public output_files: File[];

  constructor(
    stdout: string = '',
    stderr: string = '',
    output_files: File[] = []
  ) {
    this.stdout = stdout;
    this.stderr = stderr;
    this.output_files = [...output_files]; // Create a copy to avoid reference issues
  }
}

export class CodeExecutionUtils {
  static getEncodedFileContent(data: Uint8Array): string {
    const isBase64Encoded = (bytes: Uint8Array): Boolean => {
      try {
        const decoded = atob(new TextDecoder().decode(bytes));
        const reencoded = btoa(decoded);
        return reencoded === new TextDecoder().decode(bytes);
      } catch {
        return false;
      }
    };

    const textData = new TextDecoder().decode(data);
    return isBase64Encoded(data) ? textData : btoa(textData);
  }
  static extractCodeAndTruncateContent(
    content: Content,
    codeBlockDelimiter: [string, string][]
  ): string | null {
    if (content == null || content.parts == null) {
      return null;
    }
    for (const [idx, part] of content.parts.entries()) {
      if (
        part.executableCode &&
        (idx == content.parts.length - 1 ||
          !content.parts[idx + 1].codeExecutionResult)
      ) {
        content.parts = content.parts.slice(0, idx + 1);
        const codePart = part.executableCode.code ?? null;
        return codePart;
      }
    }
    const textParts = content.parts.filter(
      (p) => p.text && p.text.trim.length > 0
    );
    if (!textParts) {
      return null;
    }
    const textPartsCopy = structuredClone(textParts[0]);
    const responseText = textParts.map((p) => p.text).join('\n');
    const leadingDelimiterPattern = codeBlockDelimiter
      .map((d) => d[0])
      .join('|');
    const trailingDelimiterPattern = codeBlockDelimiter
      .map((d) => d[1])
      .join('|');
    const pattern = new RegExp(
      `(?<prefix>.*?)(${leadingDelimiterPattern})(?<code>.*?)(${trailingDelimiterPattern})(?<suffix>.*?)$`,
      's'
    );
    const patternMatch = pattern.exec(responseText);
    if (!patternMatch) {
      return null;
    }

    const codeStr = patternMatch.groups?.code;
    if (!codeStr) {
      return null;
    }

    content.parts = [];

    if (patternMatch.groups?.prefix) {
      textPartsCopy.text = patternMatch.groups.prefix;
      content.parts.push(textPartsCopy);
    }

    content.parts.push(CodeExecutionUtils.buildExecutableCodePart(codeStr));

    return patternMatch.groups!.code;
  }
  static buildExecutableCodePart(code: string): Part {
    return {
      executableCode: {
        _code: code,
        language: 'PYTHON',
      },
    } as Part;
  }
  static buildExecutionResultPart(
    codeexecutionresult: CodeExecutionResult
  ): Part {
    if (codeexecutionresult.stderr) {
      return {
        codeExecutionResult: {
          outcome: 'OUTCOME_FAILED',
          output: codeexecutionresult.stderr,
        },
      } as Part;
    }
    const finalResult = [];
    if (codeexecutionresult.stdout || !codeexecutionresult.output_files) {
      finalResult.push(
        `Code execution result:\n ${codeexecutionresult.stdout}\n`
      );
    }
    if (codeexecutionresult.output_files) {
      finalResult.push(
        `Saved artifacts:\n ${codeexecutionresult.output_files.map((f) => `\`${f.name}\``).join(',')}`
      );
    }
    return {
      codeExecutionResult: {
        outcome: 'OUTCOME_OK',
        output: finalResult.join(`\n\n`),
      },
    } as Part;
  }
  /**
   * Converts the code execution parts to text parts in a Content.
   * @param content - The mutable content to convert the code execution parts to text parts.
   * @param codeBlockDelimiter - The delimiter to format the code block.
   * @param executionResultDelimiters - The delimiter to format the code execution result.
   */
  static convertCodeExecutionParts(
    content: Content,
    codeBlockDelimiter: [string, string],
    executionResultDelimiters: [string, string]
  ): void {
    if (!content.parts) {
      return;
    }

    // Handle the conversion of trailing executable code parts.
    const lastPart = content.parts[content.parts.length - 1];
    if (lastPart.executableCode) {
      content.parts[content.parts.length - 1] = {
        text:
          codeBlockDelimiter[0] +
          lastPart.executableCode.code +
          codeBlockDelimiter[1],
      };
    }
    // Handle the conversion of trailing code execution result parts.
    // Skip if the Content has multiple parts, which means the Content is
    // likely generated by the model.
    else if (content.parts.length === 1 && lastPart.codeExecutionResult) {
      content.parts[content.parts.length - 1] = {
        text:
          executionResultDelimiters[0] +
          lastPart.codeExecutionResult.output +
          executionResultDelimiters[1],
      };
    }

    content.role = 'user';
  }
}
