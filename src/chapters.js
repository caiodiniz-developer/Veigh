/**
 * Os capítulos do site, na ordem do documento.
 *
 * Estava tudo dentro do CinemaLayer, mas três coisas precisam da mesma lista —
 * a cartela que nomeia o ato, a barra lateral que mostra onde você está e os
 * créditos finais — e três cópias divergem no primeiro capítulo que alguém
 * renomear. O seletor é o vínculo com o DOM: cada seção já tem a sua classe,
 * então nenhum componente precisa de id novo nem de prop atravessando a
 * árvore inteira.
 */
export const CHAPTERS = [
  { sel: '.evom-intro', num: 'I', title: 'Eu Venci o Mundo' },
  { sel: '.evom-manifesto', num: 'II', title: 'Antes dos prédios' },
  { sel: '.evom-history', num: 'III', title: 'A história' },
  { sel: '.evom-tl', num: 'IV', title: 'A trajetória' },
  { sel: '.evom-shatter', num: 'V', title: 'O disco' },
  { sel: '.evom-player', num: 'VI', title: 'Ouça o projeto' },
  { sel: '.evom-stats', num: 'VII', title: 'Os números' },
  { sel: '.evom-disc', num: 'VIII', title: 'Discografia' },
  { sel: '.evom-wall', num: 'IX', title: 'Mesa de luz' },
  { sel: '.evom-clips', num: 'X', title: 'A sala de projeção' },
  { sel: '.evom-shows', num: 'XI', title: 'Dos prédios para os palcos' },
  { sel: '.evom-world', num: 'XII', title: 'Do Brasil pro mundo' },
  { sel: '.evom-finale', num: 'XIII', title: 'Eu Venci o Mundo' },
]
