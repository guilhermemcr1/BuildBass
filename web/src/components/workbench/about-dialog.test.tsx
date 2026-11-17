import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vite-plus/test';
import { CREDITS } from '@/lib/credits';
import { renderWithProviders } from '@/test/render';
import { AboutDialog } from './about-dialog';

describe('AboutDialog', () => {
    test('mostra a autoria e os links para GitHub e portfólio', () => {
        renderWithProviders(
            <AboutDialog open onOpenChange={() => undefined} />,
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Sobre o BuildBass',
        });

        expect(within(dialog).getByText('Guilherme G.')).toBeInTheDocument();
        expect(
            within(dialog).getByRole('link', { name: 'GitHub' }),
        ).toHaveAttribute('href', CREDITS.githubUrl);
        expect(
            within(dialog).getByRole('link', { name: 'Portfólio' }),
        ).toHaveAttribute('href', 'https://galarca.dev');
    });

    test('todo link externo abre em outra aba sem vazar o referrer', () => {
        renderWithProviders(
            <AboutDialog open onOpenChange={() => undefined} />,
        );

        const external = screen
            .getAllByRole('link')
            .filter((link) => link.getAttribute('href')?.startsWith('http'));

        expect(external.length).toBeGreaterThan(0);

        for (const link of external) {
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });

    test('oferece o e-mail de contato para suporte e sugestões', () => {
        renderWithProviders(
            <AboutDialog open onOpenChange={() => undefined} />,
        );

        const link = screen.getByRole('link', { name: 'contato@galarca.dev' });

        expect(link.getAttribute('href')).toMatch(
            /^mailto:contato@galarca\.dev\?subject=/,
        );
        expect(link).not.toHaveAttribute('target');
    });

    test('traduz o título para o inglês', () => {
        renderWithProviders(
            <AboutDialog open onOpenChange={() => undefined} />,
            'en',
        );

        expect(
            screen.getByRole('dialog', { name: 'About BuildBass' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Portfolio' }),
        ).toBeInTheDocument();
    });
});
