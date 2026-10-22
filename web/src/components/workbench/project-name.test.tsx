import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { renderWithProviders } from '@/test/render';
import {
    initialWorkspace,
    projectStore,
    useWorkspace,
} from '@/stores/workspace';
import { ProjectName } from './project-name';

function workspace() {
    return useWorkspace.getState();
}

function activeName() {
    return projectStore(workspace().activeId).getState().data.name;
}

describe('ProjectName', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('mostra o nome do projeto ativo com o rótulo "Nome do projeto"', () => {
        renderWithProviders(<ProjectName />);

        expect(
            screen.getByRole('textbox', { name: 'Nome do projeto' }),
        ).toHaveValue('Projeto sem nome');
    });

    test('Enter confirma o nome novo', async () => {
        renderWithProviders(<ProjectName />);
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);
        await userEvent.type(input, 'Caixa A{Enter}');

        expect(activeName()).toBe('Caixa A');
    });

    test('Esc cancela e restaura o nome anterior', async () => {
        renderWithProviders(<ProjectName />);
        act(() =>
            projectStore(workspace().activeId).getState().setName('Caixa A'),
        );
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);
        await userEvent.type(input, 'Outra{Escape}');

        expect(activeName()).toBe('Caixa A');
        expect(input).toHaveValue('Caixa A');
    });

    test('nome vazio volta ao anterior', async () => {
        renderWithProviders(<ProjectName />);
        act(() =>
            projectStore(workspace().activeId).getState().setName('Caixa A'),
        );
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);
        await userEvent.keyboard('{Enter}');

        expect(activeName()).toBe('Caixa A');
        expect(input).toHaveValue('Caixa A');
    });

    test('trocar de aba troca o nome mostrado', () => {
        renderWithProviders(<ProjectName />);
        act(() => {
            workspace().openProject(createProjectData('Sub'));
        });

        expect(
            screen.getByRole('textbox', { name: 'Nome do projeto' }),
        ).toHaveValue('Sub');

        act(() => workspace().setActive(workspace().projects[0].id));
        expect(
            screen.getByRole('textbox', { name: 'Nome do projeto' }),
        ).toHaveValue('Projeto sem nome');
    });

    test('o botão de cor ao lado do nome abre o seletor e troca a cor', async () => {
        renderWithProviders(<ProjectName />);
        const trigger = screen.getByRole('button', {
            name: 'Cor de Projeto sem nome',
        });

        await userEvent.click(trigger);
        await userEvent.click(screen.getByRole('radio', { name: 'Cor 6' }));

        expect(workspace().projects[0].color).toBe(6);
        await userEvent.keyboard('{Escape}');
        expect(
            screen
                .getByRole('button', { name: 'Cor de Projeto sem nome' })
                .querySelector('span'),
        ).toHaveClass('bg-series-6');
    });

    test('os ícones de salvar e desistir só aparecem durante a edição', async () => {
        renderWithProviders(<ProjectName />);

        expect(
            screen.queryByRole('button', { name: 'Salvar nome' }),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('textbox', { name: 'Nome do projeto' }),
        );

        expect(
            screen.getByRole('button', { name: 'Salvar nome' }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: 'Cancelar edição do nome' }),
        ).toBeVisible();
    });

    test('o ícone de salvar confirma o nome e some', async () => {
        renderWithProviders(<ProjectName />);
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);
        await userEvent.type(input, 'Caixa B');
        await userEvent.click(
            screen.getByRole('button', { name: 'Salvar nome' }),
        );

        expect(activeName()).toBe('Caixa B');
        expect(
            screen.queryByRole('button', { name: 'Salvar nome' }),
        ).toBeNull();
    });

    test('o ícone de desistir restaura o nome e não grava nada', async () => {
        renderWithProviders(<ProjectName />);
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);
        await userEvent.type(input, 'Caixa C');
        await userEvent.click(
            screen.getByRole('button', { name: 'Cancelar edição do nome' }),
        );

        // O projeto novo guarda o nome vazio e a tela mostra o padrão.
        expect(activeName()).toBe('');
        expect(input).toHaveValue('Projeto sem nome');
        expect(
            screen.queryByRole('button', { name: 'Salvar nome' }),
        ).toBeNull();
    });

    test('nome vazio deixa o salvar desativado', async () => {
        renderWithProviders(<ProjectName />);
        const input = screen.getByRole('textbox', { name: 'Nome do projeto' });

        await userEvent.clear(input);

        expect(
            screen.getByRole('button', { name: 'Salvar nome' }),
        ).toBeDisabled();
    });
});
