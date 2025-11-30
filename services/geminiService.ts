import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, RiskAnalysis, RiskLevel } from "../types";

const mapRiskLevel = (level: string): RiskLevel => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return RiskLevel.CRITICAL;
    case 'HIGH': return RiskLevel.HIGH;
    case 'MEDIUM': return RiskLevel.MEDIUM;
    case 'LOW': return RiskLevel.LOW;
    default: return RiskLevel.SAFE;
  }
};

export const analyzeTransactionsWithGemini = async (
  transactions: Transaction[], 
  walletAddress: string,
  heuristicRules: string[] = [] // Pass the rules detected by frontend
): Promise<RiskAnalysis> => {
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We only send a subset to avoid huge token usage
    const txContext = JSON.stringify(transactions.slice(0, 30).map(t => ({
      hash: t.hash,
      type: t.type,
      from: t.from,
      to: t.to,
      value: t.value,
      asset: t.asset
    })));

    const rulesContext = heuristicRules.length > 0 
      ? `The following risk patterns were ALREADY detected by our rule engine: ${JSON.stringify(heuristicRules)}.`
      : "No automated heuristic rules were triggered.";

    const prompt = `
      You are a specialized Web3 security analyst focusing on the Tron (TRC20) network and USDT scams.
      Analyze the transaction history for wallet: ${walletAddress}.
      
      ${rulesContext}

      Specific Threats to look for on Tron:
      1. "Pig Butchering" (Sha Zhu Pan): Large transfers to unverified addresses after a period of small "trust-building" interactions.
      2. Fake Mining Pool / Smart Contract Scams: Unlimited approvals (value 0 usually means approve all in UI, or specific max uint256).
      3. Dusting: Many small inbound transfers (< 1 USDT) trying to deanonymize or spam the wallet.
      4. Fake USDT: Transfers of tokens with symbol USDT but wrong contract (Standard is TJk5...).

      Provide a human-readable summary explaining the risk level. If heuristic rules were triggered, explain why those are dangerous.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        { text: `Transaction Data: ${txContext}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER, description: "Combined risk score 0-100" },
            riskLevel: { type: Type.STRING, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"] },
            summary: { type: Type.STRING, description: "Detailed security assessment summary" },
            suspiciousWalletsFound: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of addresses identified as suspicious"
            },
            analyzedTransactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hash: { type: Type.STRING },
                  aiRiskLabel: { type: Type.STRING },
                  aiRiskScore: { type: Type.NUMBER },
                  aiReasoning: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    // Merge AI results with original transactions
    const mergedTxs = transactions.map(tx => {
      const analysis = result.analyzedTransactions?.find((at: any) => at.hash === tx.hash);
      return {
        ...tx,
        aiRiskLabel: analysis?.aiRiskLabel || "Normal",
        aiRiskScore: analysis?.aiRiskScore || 0,
        aiReasoning: analysis?.aiReasoning || "Standard transaction."
      };
    });

    return {
      riskScore: result.riskScore || 0,
      riskLevel: mapRiskLevel(result.riskLevel),
      summary: result.summary || "No analysis available.",
      suspiciousWalletsFound: result.suspiciousWalletsFound || [],
      analyzedTransactions: mergedTxs,
      ruleMatches: heuristicRules // Pass this back through
    };

  } catch (error) {
    console.error("Gemini Analysis Failed", error);
    // Fallback using heuristics only if AI fails
    return {
      riskScore: 0,
      riskLevel: RiskLevel.LOW,
      summary: `AI Analysis unavailable. Heuristic rules triggered: ${heuristicRules.join(', ') || 'None'}`,
      suspiciousWalletsFound: [],
      analyzedTransactions: transactions.map(t => ({...t, aiRiskLabel: 'Unanalyzed', aiRiskScore: 0, aiReasoning: 'AI Error'})),
      ruleMatches: heuristicRules
    };
  }
};