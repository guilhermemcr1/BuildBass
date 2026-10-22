import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
    test('mostra seis cores com nome acessível e marca a ativa', () => {
        renderWithProviders(<ColorPicker value={3} onChange={() => undefined} />);
        const group = screen.getByRole('radiogroup', { name: 'Cor do projeto' });

        expect(group).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(6);
        expect(screen.getByRole('radio', { name: 'Cor 3' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Cor 1' })).not.toBeChecked();
    });

    test('escolhe por clique e por teclado', async () => {
        const onChange = vi.fn();
        renderWithProviders(<ColorPicker value={1} onChange={onChange} />);

        await userEvent.click(screen.getByRole('radio', { name: 'Cor 5' }));
        expect(onChange).toHaveBeenLastCalledWith(5);

        screen.getByRole('radio', { name: 'Cor 1' }).focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith(2);
    });

    test('a cor ativa tem marca além da cor', () => {
        renderWithProviders(<ColorPicker value={2} onChange={() => undefined} />);

        expect(
            screen.getByRole('radio', { name: 'Cor 2' }).closest('label'),
        ).toContainElement(document.querySelector('svg'));
    });
});
