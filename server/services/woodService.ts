/**
 * Wood Calculation Service
 * Specializing in commercial timber measurements (Board Feet, M3)
 */

export const woodService = {
  /**
   * Calculate Board Feet (Pies Tablares)
   * Formula: (Thickness" * Width" * Length') / 12
   */
  calculateBoardFeet(thicknessInch: number, widthInch: number, lengthFeet: number): number {
    return (thicknessInch * widthInch * lengthFeet) / 12;
  },

  /**
   * Convert Metric to Commercial Inches/Feet
   * 30cm -> 12"
   * 2.5cm -> 1"
   * 250cm -> 8'
   */
  metricToCommercial(widthCm: number, thicknessCm: number, lengthCm: number) {
    const widthInch = Math.round(widthCm / 2.5);
    const thicknessInch = Math.round(thicknessCm / 2.5);
    const lengthFeet = Math.round(lengthCm / 30.48);
    
    return {
      widthInch,
      thicknessInch,
      lengthFeet
    };
  },

  /**
   * Calculate Public Price based on margin
   */
  calculatePublicPrice(costPerFoot: number, marginPercent: number): number {
    return costPerFoot * (1 + marginPercent / 100);
  },

  /**
   * Calculate Profit
   */
  calculateProfit(cost: number, price: number, quantity: number): number {
    return (price - cost) * quantity;
  }
};
