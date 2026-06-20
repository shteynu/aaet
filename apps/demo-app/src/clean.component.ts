function Component(metadata: unknown): ClassDecorator {
  void metadata;
  return () => undefined;
}

const ChangeDetectionStrategy = { OnPush: 'OnPush' } as const;

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>AAET clean integration fixture</p>'
})
export class CleanComponent {}
