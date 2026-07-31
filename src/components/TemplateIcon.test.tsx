import { render, screen } from '@testing-library/react';
import { TemplateIcon } from './TemplateIcon';

describe('TemplateIcon', () => {
  it('uses a distinct image for each built-in operating system template', () => {
    const { container, rerender } = render(<TemplateIcon templateKey="winxp" />);
    const sources = [container.querySelector('img')?.getAttribute('src')];

    for (const templateKey of ['win98', 'win11', 'linux']) {
      rerender(<TemplateIcon templateKey={templateKey} />);
      sources.push(container.querySelector('img')?.getAttribute('src'));
    }

    expect(new Set(sources).size).toBe(4);
  });

  it('keeps the caller fallback for custom templates', () => {
    render(<TemplateIcon templateKey="custom" fallback={<span>custom icon</span>} />);
    expect(screen.getByText('custom icon')).toBeInTheDocument();
  });
});
