/** CLI 명령 공통 결과 타입. */
export interface CliResult {
  readonly exitCode: number;
  readonly output: string;
}
