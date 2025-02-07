import React from "react";

export const onRenderBody = ({ setHeadComponents }) => {
    setHeadComponents([
        <script
            key="reo-script"
            dangerouslySetInnerHTML={{
                __html: `
          !function(){var e,t,n;e="247876b59f9c0d5",t=function(){Reo.init({clientID:"247876b59f9c0d5"})},(n=document.createElement("script")).src="https://static.reo.dev/"+e+"/reo.js",n.defer=!0,n.onload=t,document.head.appendChild(n)}();
        `,
            }}
        />,
    ]);
};
