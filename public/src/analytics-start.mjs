import {analyticsConfig} from './analytics-config.mjs';
import {initAnalytics} from './analytics.mjs';
if(typeof window!=='undefined'&&typeof document!=='undefined')initAnalytics(analyticsConfig);
