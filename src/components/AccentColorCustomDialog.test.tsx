import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccentColorCustomDialog } from './AccentColorCustomDialog';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) =>
    ({
      'settings.accentColorDialogTitle': '自定义强调色',
      'settings.accentColorDialogDescription': '分别设置浅色与深色界面的主色和表面色。',
      'settings.accentColorAppliesImmediately': '修改会立即应用',
      'settings.light': '浅色',
      'settings.dark': '深夜',
      'settings.lightModeColors': '浅色模式',
      'settings.darkModeColors': '深色模式',
      'settings.primaryColor': '主色',
      'settings.surfaceColor': '表面色',
      'settings.savedColorTemplates': '已保存模板',
      'settings.savedColorTemplatesDescription': '保存常用配色，之后可以直接切换。',
      'settings.noSavedColorTemplates': '还没有保存的配色模板',
      'settings.saveColorTemplate': '保存为模板',
      'settings.colorTemplateNamePlaceholder': '输入模板名称',
      'settings.createColorTemplate': '创建',
      'app.close': '关闭',
      'app.cancel': '取消',
      'app.confirm': '完成'
    })[key] ?? key
}));

const accentColor = {
  mode: 'custom' as const,
  preset: 'purple' as const,
  custom: {
    lightPrimary: '#BCA0C9',
    lightSurface: '#F7EFFF',
    darkPrimary: '#D3ABF7',
    darkSurface: '#2E1F3F'
  },
  templates: []
};

describe('AccentColorCustomDialog', () => {
  it('portals outside its clipped settings container and shows the redesigned color groups', () => {
    const { container } = render(
      <div className="settings-drawer">
        <AccentColorCustomDialog open value={accentColor} onChange={() => undefined} onClose={() => undefined} />
      </div>
    );

    const dialog = screen.getByRole('dialog', { name: '自定义强调色' });
    expect(document.body).toContainElement(dialog);
    expect(container).not.toContainElement(dialog);
    expect(screen.getByRole('heading', { name: '浅色模式' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '深色模式' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('主色')).toHaveLength(2);
    expect(screen.getAllByLabelText('表面色')).toHaveLength(2);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<AccentColorCustomDialog open value={accentColor} onChange={() => undefined} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
