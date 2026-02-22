import { FeatureSet } from './featureEngine';

export interface ProbabilityResult {
  normal: number;
  delay: number;
  cancel: number;
}

export interface SoftmaxParameters {
  aN: number;
  bN: number;
  
  aC: number;
  bC: number;
  
  aD: number;
  bD: number;
  center: number;
}

export class ProbabilityModelService {
  private defaultParams: SoftmaxParameters = {
    aN: 2.0,
    bN: 0.8,
    aC: -4.0,
    bC: 0.6,
    aD: 1.0,
    bD: 0.3,
    center: 4.0
  };

  computeProbabilities(severityScore: number, params?: Partial<SoftmaxParameters>): ProbabilityResult {
    const p = { ...this.defaultParams, ...params };
    
    const zN = p.aN - p.bN * severityScore;
    const zC = p.aC + p.bC * severityScore;
    const zD = p.aD - p.bD * Math.pow(severityScore - p.center, 2);
    
    const expN = Math.exp(zN);
    const expD = Math.exp(zD);
    const expC = Math.exp(zC);
    const sum = expN + expD + expC;
    
    return {
      normal: expN / sum,
      delay: expD / sum,
      cancel: expC / sum
    };
  }

  getMostLikelyCall(probabilities: ProbabilityResult): { call: string; confidence: 'High' | 'Medium' | 'Low' } {
    const probs = [
      { name: 'Normal', value: probabilities.normal },
      { name: 'Delay', value: probabilities.delay },
      { name: 'Cancel', value: probabilities.cancel }
    ];
    
    probs.sort((a, b) => b.value - a.value);
    
    const topProb = probs[0].value;
    const secondProb = probs[1].value;
    const margin = topProb - secondProb;
    
    let confidence: 'High' | 'Medium' | 'Low';
    if (margin >= 0.3) {
      confidence = 'High';
    } else if (margin >= 0.15) {
      confidence = 'Medium';
    } else {
      confidence = 'Low';
    }
    
    let call: string;
    if (topProb >= 0.55) {
      call = `Likely ${probs[0].name}`;
    } else {
      call = `Toss-up: ${probs[0].name} vs ${probs[1].name}`;
    }
    
    return { call, confidence };
  }

  getLogitTrace(severityScore: number, params?: Partial<SoftmaxParameters>) {
    const p = { ...this.defaultParams, ...params };
    
    const zN = p.aN - p.bN * severityScore;
    const zC = p.aC + p.bC * severityScore;
    const zD = p.aD - p.bD * Math.pow(severityScore - p.center, 2);
    
    const expN = Math.exp(zN);
    const expD = Math.exp(zD);
    const expC = Math.exp(zC);
    const sum = expN + expD + expC;
    
    return {
      logits: { zN, zD, zC },
      exponentials: { expN, expD, expC },
      sum,
      probabilities: {
        normal: expN / sum,
        delay: expD / sum,
        cancel: expC / sum
      },
      formulas: {
        normal: `z_N = ${p.aN} - ${p.bN} × ${severityScore} = ${zN.toFixed(3)}`,
        delay: `z_D = ${p.aD} - ${p.bD} × (${severityScore} - ${p.center})² = ${zD.toFixed(3)}`,
        cancel: `z_C = ${p.aC} + ${p.bC} × ${severityScore} = ${zC.toFixed(3)}`
      }
    };
  }
}

export const probabilityModel = new ProbabilityModelService();
