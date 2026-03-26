import { assertAllowedLifecycleTransition } from './jobs.lifecycle';

describe('jobs.lifecycle', () => {
  describe('allowed transitions', () => {
    it('allows queued -> processing', () => {
      expect(() =>
        assertAllowedLifecycleTransition('queued', 'processing'),
      ).not.toThrow();
    });

    it('allows processing -> ready', () => {
      expect(() =>
        assertAllowedLifecycleTransition('processing', 'ready'),
      ).not.toThrow();
    });

    it('allows processing -> failed', () => {
      expect(() =>
        assertAllowedLifecycleTransition('processing', 'failed'),
      ).not.toThrow();
    });
  });

  describe('forbidden transitions', () => {
    it('rejects queued -> ready', () => {
      expect(() => assertAllowedLifecycleTransition('queued', 'ready')).toThrow(
        /Illegal lifecycle transition/,
      );
    });

    it('rejects ready -> processing', () => {
      expect(() =>
        assertAllowedLifecycleTransition('ready', 'processing'),
      ).toThrow(/Illegal lifecycle transition/);
    });

    it('rejects ready -> failed', () => {
      expect(() => assertAllowedLifecycleTransition('ready', 'failed')).toThrow(
        /Illegal lifecycle transition/,
      );
    });

    it('rejects failed -> processing', () => {
      expect(() =>
        assertAllowedLifecycleTransition('failed', 'processing'),
      ).toThrow(/Illegal lifecycle transition/);
    });
  });
});
