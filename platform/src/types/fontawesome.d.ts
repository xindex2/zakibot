// Type declaration for @fortawesome/react-fontawesome
// Needed because the package uses 'exports' field which isn't supported by moduleResolution: "Node"
declare module '@fortawesome/react-fontawesome' {
    import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
    import { ComponentType, CSSProperties, HTMLAttributes } from 'react';

    export interface FontAwesomeIconProps extends HTMLAttributes<SVGSVGElement> {
        icon: IconDefinition;
        size?: string;
        spin?: boolean;
        pulse?: boolean;
        className?: string;
        style?: CSSProperties;
    }

    export const FontAwesomeIcon: ComponentType<FontAwesomeIconProps>;
}
