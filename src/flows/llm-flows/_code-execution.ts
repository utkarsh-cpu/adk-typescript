import { InvocationContext } from '@/agents/invocation-context';
import { LlmRequest, LlmResponse } from '@/models';
import { Event, EventActions } from '@/events';
import {
  BaseLlmRequestProcessor,
  BaseLlmResponseProcessor,
} from '@/flows/llm-flows/_base-llm-processor';
import { CodeExecutorContext } from '@/code-executors';
import { BuiltInCodeExecutor } from '@/code-executors/built-in-code-executor';
import {
  CodeExecutionInput,
  CodeExecutionResult,
  CodeExecutionUtils,
  File,
} from '@/code-executors/code-execution-utils';

interface DataFileUtil {
  extension: string;
  loaderCodeTemplate: string;
}
const _DATA_FILE_UTIL_MAP: Record<string, DataFileUtil> = {
  'text/csv': {
    extension: '.csv',
    loaderCodeTemplate: "pd.read_csv('{filename}')",
  },
};
const _DATA_FILE_HELPER_LIB: string = `
import pandas as pd

def explore_df(df: pd.DataFrame) -> None:
  """Prints some information about a pandas DataFrame."""

  with pd.option_context(
      'display.max_columns', None, 'display.expand_frame_repr', False
  ):
    # Print the column names to never encounter KeyError when selecting one.
    df_dtypes = df.dtypes

    # Obtain information about data types and missing values.
    df_nulls = (len(df) - df.isnull().sum()).apply(
        lambda x: f'{x} / {df.shape[0]} non-null'
    )

    # Explore unique total values in columns using '.unique()'.
    df_unique_count = df.apply(lambda x: len(x.unique()))

    # Explore unique values in columns using '.unique()'.
    df_unique = df.apply(lambda x: crop(str(list(x.unique()))))

    df_info = pd.concat(
        (
            df_dtypes.rename('Dtype'),
            df_nulls.rename('Non-Null Count'),
            df_unique_count.rename('Unique Values Count'),
            df_unique.rename('Unique Values'),
        ),
        axis=1,
    )
    df_info.index.name = 'Columns'
    print(f"""Total rows: {df.shape[0]}
Total columns: {df.shape[1]}

{df_info}""")
`;
class _CodeExecutionRequestProcessor extends BaseLlmRequestProcessor {}
