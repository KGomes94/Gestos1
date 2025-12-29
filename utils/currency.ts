
/**
 * Biblioteca utilitária para aritmética monetária segura.
 * Converte valores para inteiros (centavos) antes de operar para evitar erros de ponto flutuante.
 * Ex: 0.1 + 0.2 = 0.3 (e não 0.30000000000000004)
 */
export const currency = {
  /**
   * Adição segura: (a + b)
   */
  add: (a: number, b: number): number => {
    return (Math.round(a * 100) + Math.round(b * 100)) / 100;
  },

  /**
   * Subtração segura: (a - b)
   */
  sub: (a: number, b: number): number => {
    return (Math.round(a * 100) - Math.round(b * 100)) / 100;
  },

  /**
   * Multiplicação segura: (amount * factor)
   * Útil para quantidades ou taxas.
   */
  mul: (amount: number, factor: number): number => {
    return Math.round(amount * factor * 100) / 100;
  },

  /**
   * Divisão segura: (amount / divisor)
   */
  div: (amount: number, divisor: number): number => {
    if (divisor === 0) return 0;
    return Math.round((amount / divisor) * 100) / 100;
  },

  /**
   * Arredonda um valor para 2 casas decimais.
   */
  round: (value: number): number => {
    return Math.round(value * 100) / 100;
  }
};
