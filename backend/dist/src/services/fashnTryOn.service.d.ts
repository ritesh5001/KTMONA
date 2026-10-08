import type { CreateTryOnInput } from '../validators/tryOn.validation.js';
export type TryOnResponse = {
    predictionId: string;
    status: 'completed';
    productImage: string;
    output: string[];
};
export declare class FashnTryOnService {
    private get apiKey();
    createTryOn(input: CreateTryOnInput): Promise<TryOnResponse>;
    private startPrediction;
    /**
     * How long to wait before the next status check.
     *
     * A flat interval meant the buyer could sit staring at the try-on spinner for a
     * further full interval after the image was already rendered — pure dead time on
     * a feature people judge by how quickly it responds. Checking sooner at first and
     * then easing off keeps the fast cases fast without hammering FASHN for the slow
     * ones, and never exceeds the configured interval as a ceiling.
     */
    private pollDelayMs;
    private pollPrediction;
}
export declare const fashnTryOnService: FashnTryOnService;
//# sourceMappingURL=fashnTryOn.service.d.ts.map