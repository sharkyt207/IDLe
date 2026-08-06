/** Contract every screen implements. The shell owns switching and refreshing. */
export interface Screen {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly root: HTMLElement;
  /** Rebuild the visible content. Called on entry and throttled while active. */
  refresh(): void;
  onEnter?(): void;
  onLeave?(): void;
  /** Hide the tab until the feature is unlocked. */
  available?(): boolean;
  /** Show a dot on the tab, e.g. "something affordable in here". */
  hasNews?(): boolean;
}
