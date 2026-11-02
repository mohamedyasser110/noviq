import 'next-intl';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof import('./i18n/en.json');
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'linear-gradient': React.DetailedHTMLProps<React.SVGAttributes<SVGLinearGradientElement>, SVGLinearGradientElement>;
      'radial-gradient': React.DetailedHTMLProps<React.SVGAttributes<SVGRadialGradientElement>, SVGRadialGradientElement>;
      stop: React.DetailedHTMLProps<React.SVGAttributes<SVGStopElement>, SVGStopElement>;
      defs: React.DetailedHTMLProps<React.SVGAttributes<SVGDefsElement>, SVGDefsElement>;
      filter: React.DetailedHTMLProps<React.SVGAttributes<SVGFilterElement>, SVGFilterElement>;
      feGaussianBlur: React.DetailedHTMLProps<React.SVGAttributes<SVGFEGaussianBlurElement>, SVGFEGaussianBlurElement>;
      feMerge: React.DetailedHTMLProps<React.SVGAttributes<SVGFEMergeElement>, SVGFEMergeElement>;
      feMergeNode: React.DetailedHTMLProps<React.SVGAttributes<SVGFEMergeNodeElement>, SVGFEMergeNodeElement>;
      g: React.DetailedHTMLProps<React.SVGAttributes<SVGGElement>, SVGGElement>;
      path: React.DetailedHTMLProps<React.SVGAttributes<SVGPathElement>, SVGPathElement>;
    }
  }
}