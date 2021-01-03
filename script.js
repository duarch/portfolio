window.
onload
    = function() {
        Particles.
        init
            ({
                // normal options
                selector: '.background',
                maxParticles: 50,
                color: ['#DA0463', '#404B69', '#DBEDF3'],
                connectParticles: true,

                // options for breakpoints
                responsive: [{
                    breakpoint: 768,
                    options: {
                        maxParticles: 50,
                        color: '#ffffff',
                        connectParticles: true
                    }
                }, {
                    breakpoint: 425,
                    options: {
                        maxParticles: 20,
                        color: '#ffffff',
                        connectParticles: false
                    }
                }, {
                    breakpoint: 320,
                    options: {
                        maxParticles: 0
                            // disables particles.js
                    }
                }]
            });
    };