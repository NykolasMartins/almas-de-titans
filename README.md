# Almas de Titans

Jogo de navegador inspirado em *Titan Souls*. Só chefes, uma vida, uma flecha.

A mecânica própria é o **Vínculo**: o recall traz a flecha até você; o Vínculo puxa você até a
flecha — e contra um corpo leve o bastante, puxa o corpo até você.

Feito com **Phaser 4**, **Vite** e JavaScript puro. Sem arquivo de áudio: todo som é sintetizado
em código com Web Audio.

## Rodar

```bash
npm install
npm run dev
```

`/` abre o título. Endereços diretos para cair numa luta: `/piramide`, `/sino`, `/crisol` e
`/sentinela`.

```bash
npm test
npm run build
```

## Controles

| Ação | Teclado/Mouse | Gamepad |
|---|---|---|
| Mover | WASD / setas | Analógico esquerdo |
| Rolar | Espaço | A |
| Mirar e atirar | Segurar botão esquerdo, soltar | Segurar RT, soltar |
| Recall (a flecha vem) | `E` / botão direito | LT |
| Vínculo (você vai) | `Shift` / botão do meio | LB |
| Pausa e opções | `Esc` | — |
| Contornos de colisão | `H` | — |

## Documentação

- [DESIGN.md](DESIGN.md) — o design completo: mecânicas, chefes, paleta, som e contrato de arte.
- [contexto.md](contexto.md) — o estado atual e o histórico de decisões, com o porquê de cada uma.
- [CLAUDE.md](CLAUDE.md) — regras de arquitetura do código.

As capturas de referência citadas no DESIGN (`screenshots/`) são do *Titan Souls* original e não
estão no repositório.
