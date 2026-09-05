export interface HealthCheckIndicator {
  name: string;
  status: 'success' | 'warning' | 'error';
  value: string;
  details?: string;
  [key: string]: any;
}

export interface HealthCheckResult {
  domain: string;
  checkedAt: string;
  isOnline: boolean;
  overallScore: number;
  scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  plainEnglishSummary: string;
  customerExplanation: {
    whatIsWrong: string;
    whatIsWorking: string[];
    whatItMeans: string;
    whatShouldHappenNext: string;
  };
  indicators: {
    onlineStatus: HealthCheckIndicator;
    httpStatus: HealthCheckIndicator;
    dnsResolution: HealthCheckIndicator;
    sslStatus: HealthCheckIndicator;
    responseTime: HealthCheckIndicator;
  };
  diagnostics: {
    hasIssues: boolean;
    issuesList: string[];
    suggestedFixes: string[];
  };
  meta: {
    adapter: string;
    finalUrl: string;
  };
}
