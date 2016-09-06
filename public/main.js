'use strict';

window.app = angular.module('FullstackGeneratedApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate', 'ui.materialize', 'angular-input-stars', 'angular-stripe']);

app.config(function ($urlRouterProvider, $locationProvider, $uiViewScrollProvider, stripeProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
    // Trigger page refresh when accessing an OAuth route
    $urlRouterProvider.when('/auth/:provider', function () {
        window.location.reload();
    });
    $uiViewScrollProvider.useAnchorScroll();

    // stripeProvider.setPublishableKey('my_key');
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

    // The given state requires an authenticated user.
    var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
        return state.data && state.data.authenticate;
    };

    // $stateChangeStart is an event fired
    // whenever the process of changing a state begins.
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

        if (!destinationStateRequiresAuth(toState)) {
            // The destination state does not require authentication
            // Short circuit with return.
            return;
        }

        if (AuthService.isAuthenticated()) {
            // The user is authenticated.
            // Short circuit with return.
            return;
        }

        // Cancel navigating to new state.
        event.preventDefault();

        AuthService.getLoggedInUser().then(function (user) {
            // If a user is retrieved, then renavigate to the destination
            // (the second time, AuthService.isAuthenticated() will work)
            // otherwise, if no user is logged in, go to "login" state.
            if (user) {
                $state.go(toState.name, toParams);
            } else {
                $state.go('login');
            }
        });
    });
});

app.config(function ($stateProvider) {

    // Register our *about* state.
    $stateProvider.state('about', {
        url: '/about',
        controller: 'AboutController',
        templateUrl: 'js/about/about.html'
    });
});

app.controller('AboutController', function ($scope, FullstackPics) {

    // Images of beautiful Fullstack people.
    $scope.images = _.shuffle(FullstackPics);
});

app.controller('AdminCtrl', function ($scope, allUserOrders, $log, allProducts, allUsers, allOrderDetails, ManageOrdersFactory) {

    $scope.products = allProducts;
    $scope.users = allUsers;
    $scope.userOrders = allUserOrders;

    //adding status to each orderDetail
    allOrderDetails.forEach(function (orderDetail) {
        ManageOrdersFactory.findStatus(orderDetail.userOrderId).then(function (status) {
            orderDetail.status = status;
        }).catch($log.error);
    });

    //adding user info to each orderDetail
    allOrderDetails.forEach(function (orderDetail) {
        ManageOrdersFactory.findUser(orderDetail.userOrderId).then(function (user) {
            orderDetail.user = user;
        }).catch($log.error);
    });
    allOrderDetails = allOrderDetails.sort(function (a, b) {
        return a.userOrderId - b.userOrderId;
    });
    allOrderDetails = _.groupBy(allOrderDetails, 'userOrderId');
    $scope.orders = $.map(allOrderDetails, function (order, i) {
        if (i) return [order];
    });
    console.log($scope.orders);
});

app.config(function ($stateProvider) {
    $stateProvider.state('admin', {
        url: '/admin',
        templateUrl: 'js/admin/admin.html',
        controller: 'AdminCtrl',
        resolve: {
            allProducts: function allProducts(ProductFactory) {
                return ProductFactory.fetchAll();
            },
            allUsers: function allUsers(UserFactory) {
                return UserFactory.fetchAll();
            },
            allOrderDetails: function allOrderDetails(ManageOrdersFactory) {
                return ManageOrdersFactory.fetchAll();
            },
            allUserOrders: function allUserOrders(ManageOrdersFactory) {
                return ManageOrdersFactory.fetchAllUserOrders();
            }
        }
    });
});

app.controller('CartCtrl', function ($scope, $log, cartContent, CartFactory) {
    $scope.cartContent = cartContent;

    $scope.remove = function (orderId) {
        CartFactory.removeFromCart(orderId).then(function (newCart) {
            $scope.cartContent = newCart;
        }).catch($log);
    };

    $scope.changeQuantity = function (cartId, quantity, addOrSubtract) {
        CartFactory.changeQuantity(cartId, quantity, addOrSubtract);
        $scope.cartContent = CartFactory.cachedCart;
    };

    $scope.checkout = CartFactory.checkout;

    $scope.total = function () {
        var total = 0;
        cartContent.forEach(function (cart) {
            return total += cart.price * cart.quantity;
        });

        return total;
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state('cart', {
        url: '/cart',
        templateUrl: 'js/cart/cart.html',
        controller: 'CartCtrl',
        resolve: {
            cartContent: function cartContent(CartFactory) {

                return CartFactory.fetchAllFromCart();
            }
        }
    });
});

app.controller('CheckoutCtrl', function ($scope, CartFactory) {

    CartFactory.fetchAllFromCart().then(function (items) {
        console.log(items);
        $scope.items = items;

        //calculating total price and put that into $scope.total
        var itemsArr = items;
        var totalPriceEach = [];
        itemsArr.forEach(function (element) {
            totalPriceEach.push(element.price * element.quantity);
        });
        $scope.total = totalPriceEach.reduce(function (prev, curr) {
            return prev + curr;
        });
    });

    $scope.checkout = CartFactory.checkout;
});

app.config(function ($stateProvider) {
    $stateProvider.state('checkout', {
        url: '/checkout',
        templateUrl: 'js/checkout/checkout.html',
        controller: 'CheckoutCtrl'
    });
});

(function () {

    'use strict';

    // Hope you didn't forget Angular! Duh-doy.

    if (!window.angular) throw new Error('I can\'t find Angular!');

    var app = angular.module('fsaPreBuilt', []);

    app.factory('Socket', function () {
        if (!window.io) throw new Error('socket.io not found!');
        return window.io(window.location.origin);
    });

    // AUTH_EVENTS is used throughout our app to
    // broadcast and listen from and to the $rootScope
    // for important events about authentication flow.
    app.constant('AUTH_EVENTS', {
        loginSuccess: 'auth-login-success',
        loginFailed: 'auth-login-failed',
        logoutSuccess: 'auth-logout-success',
        sessionTimeout: 'auth-session-timeout',
        notAuthenticated: 'auth-not-authenticated',
        notAuthorized: 'auth-not-authorized'
    });

    app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
        var statusDict = {
            401: AUTH_EVENTS.notAuthenticated,
            403: AUTH_EVENTS.notAuthorized,
            419: AUTH_EVENTS.sessionTimeout,
            440: AUTH_EVENTS.sessionTimeout
        };
        return {
            responseError: function responseError(response) {
                $rootScope.$broadcast(statusDict[response.status], response);
                return $q.reject(response);
            }
        };
    });

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push(['$injector', function ($injector) {
            return $injector.get('AuthInterceptor');
        }]);
    });

    app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

        function onSuccessfulLogin(response) {
            var data = response.data;
            Session.create(data.id, data.user);
            $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
            return data.user;
        }

        this.isAdmin = function (user) {
            return user.isAdmin;
        };

        // Uses the session factory to see if an
        // authenticated user is currently registered.
        this.isAuthenticated = function () {
            return !!Session.user;
        };

        this.getLoggedInUser = function (fromServer) {

            // If an authenticated session exists, we
            // return the user attached to that session
            // with a promise. This ensures that we can
            // always interface with this method asynchronously.

            // Optionally, if true is given as the fromServer parameter,
            // then this cached value will not be used.

            if (this.isAuthenticated() && fromServer !== true) {
                return $q.when(Session.user);
            }

            // Make request GET /session.
            // If it returns a user, call onSuccessfulLogin with the response.
            // If it returns a 401 response, we catch it and instead resolve to null.
            return $http.get('/session').then(onSuccessfulLogin).catch(function () {
                return null;
            });
        };

        this.login = function (credentials) {
            return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
                return $q.reject({ message: 'Invalid login credentials.' });
            });
        };

        this.logout = function () {
            return $http.get('/logout').then(function () {
                Session.destroy();
                $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
            });
        };
    });

    app.service('Session', function ($rootScope, AUTH_EVENTS) {

        var self = this;

        $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
            self.destroy();
        });

        $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
            self.destroy();
        });

        this.id = null;
        this.user = null;

        this.create = function (sessionId, user) {
            this.id = sessionId;
            this.user = user;
        };

        this.destroy = function () {
            this.id = null;
            this.user = null;
        };
    });
})();

app.controller('OrderHistoriesCtrl', function ($log, $scope, OrderHistoriesFactory) {

    OrderHistoriesFactory.fetchAll().then(function (userOrdersArr) {

        userOrdersArr.paidItems.forEach(function (arr, i) {
            arr.date = new Date(userOrdersArr.date[i]).toString();
        });

        $scope.userOrders = userOrdersArr.paidItems;
    }).catch($log);
});

app.config(function ($stateProvider) {
    $stateProvider.state('orderHistories', {
        url: '/histories',
        templateUrl: 'js/history/orderHistories.html',
        controller: 'OrderHistoriesCtrl'
    });
});

app.directive('animation', function ($state) {
    var animationEndEvents = 'webkitAnimationEnd oanimationend msAnimationEnd animationend';
    var createCharacters = function createCharacters() {
        var characters = {
            ash: ['ash', 'ash-green-bag'],
            others: ['james', 'cassidy', 'jessie']
        };

        function getY() {
            return (Math.random() * 3 + 29).toFixed(2);
        }

        function getZ(y) {
            return Math.floor((20 - y) * 100);
        }

        function randomCharacters(who) {
            return characters[who][Math.floor(Math.random() * characters[who].length)];
        }

        function makeCharacter(who) {

            var xDelay = who === 'ash' ? 4 : 4.8;
            var delay = '-webkit-animation-delay: ' + (Math.random() * 2.7 + xDelay).toFixed(3) + 's;';
            var character = randomCharacters(who);
            var bottom = getY();
            var y = 'bottom: ' + bottom + '%;';
            var z = 'z-index: ' + getZ(bottom) + ';';
            var style = "style='" + delay + " " + y + " " + z + "'";

            return "" + "<i class='" + character + " opening-scene' " + style + ">" + "<i class=" + character + "-right " + "style='" + delay + "'></i>" + "</i>";
        }

        var ash = Math.floor(Math.random() * 16) + 16;
        var others = Math.floor(Math.random() * 8) + 8;

        var horde = '';

        for (var i = 0; i < ash; i++) {
            horde += makeCharacter('ash');
        }

        for (var j = 0; j < others; j++) {
            horde += makeCharacter('others');
        }

        document.getElementById('humans').innerHTML = horde;
    };

    return {
        restrict: 'E',
        template: '<div class="running-animation">' + '<i class="pikachu opening-scene">' + '<i class="pikachu-right"></i>' + '<div class="quote exclamation"></div>' + '</i>' + '<div id="humans"></div>' + '</div>',
        compile: function compile() {
            return {
                pre: function pre() {
                    $('#main').addClass('here');
                    createCharacters();
                },
                post: function post() {

                    $('.opening-scene').addClass('move');
                    $('.move').on(animationEndEvents, function (e) {
                        $state.go('store');
                    });
                }
            };
        },
        scope: function scope() {}
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html'
    });
});

app.config(function ($stateProvider) {

    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'js/login/login.html',
        controller: 'LoginCtrl'
    });

    $stateProvider.state('reset', {
        url: '/reset',
        templateUrl: 'js/login/reset.html',
        controller: 'LoginCtrl'
    });

    $stateProvider.state('password', {
        url: '/reset/password/:token',
        templateUrl: 'js/login/password.reset.html',
        controller: 'LoginCtrl'
    });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state, AuthFactory, $stateParams, CartFactory) {

    $scope.login = {};
    $scope.error = null;
    $scope.token = $stateParams.token;

    $scope.forgetPassword = function (email) {
        AuthFactory.forgetPassword(email).then(function () {
            Materialize.toast('Check your email', 1000);
        });
    };
    $scope.resetPassword = function (token, password) {
        AuthFactory.resetPassword(password).then(function () {
            $state.go('store');
        });
    };

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function () {
            return CartFactory.fetchAllFromCart();
        }).then(function (cart) {
            $state.go('store');
        }).catch(function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});

app.config(function ($stateProvider) {

    $stateProvider.state('membersOnly', {
        url: '/members-area',
        template: '<img ng-repeat="item in stash" width="300" ng-src="{{ item }}" />',
        controller: function controller($scope, SecretStash) {
            SecretStash.getStash().then(function (stash) {
                $scope.stash = stash;
            });
        },
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        }
    });
});

app.factory('SecretStash', function ($http) {

    var getStash = function getStash() {
        return $http.get('/api/members/secret-stash').then(function (response) {
            return response.data;
        });
    };

    return {
        getStash: getStash
    };
});
app.controller('PaymentCtrl', function ($scope, UserFactory, $log, CartFactory, totalCost, arrayOfItems) {
    $scope.info = {};

    $scope.validateUser = function () {

        UserFactory.updateUserBeforePayment($scope.info).then(function () {
            $scope.showCC = true;
        }).catch($log.error);
    };
    $scope.totalCost = totalCost;
    $scope.arrayOfItems = arrayOfItems;
    $scope.stringOfItems = arrayOfItems.map(function (item) {
        return item.title;
    }).join(',');
});
app.config(function ($stateProvider) {
    $stateProvider.state('payment', {
        url: '/payment',
        templateUrl: 'js/payment/payment.html',
        controller: 'PaymentCtrl',
        resolve: {
            totalCost: function totalCost(CartFactory) {
                return CartFactory.getTotalCost();
            },
            arrayOfItems: function arrayOfItems(CartFactory) {
                return CartFactory.fetchAllFromCart();
            }
        }
    });
});

app.controller('ProductCtrl', function ($scope, theProduct, allReviews, ProductFactory, CartFactory) {
    // product
    $scope.newReview = {};
    $scope.product = theProduct;
    $scope.reviews = allReviews;
    // review
    $scope.modalOpen = false;
    $scope.submitReview = function () {
        $scope.newReview.productId = $scope.product.id;
        ProductFactory.createReview($scope.product.id, $scope.newReview).then(function () {
            $scope.reviews = ProductFactory.cachedReviews;
            $scope.newReview = {};
            Materialize.toast('Thank you!', 1000);
        }).catch(function () {
            Materialize.toast('Something went wrong', 1000);
        });
    };
    // add to cart
    $scope.addToCart = function () {
        CartFactory.addToCart($scope.product.id, $scope.quantity);
    };
    $scope.arrayMaker = function (num) {
        var arr = [];
        for (var i = 1; i <= num; i++) {
            arr.push(i);
        }
        return arr;
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state('product', {
        autoscroll: 'true',
        url: '/products/:productId',
        templateUrl: 'js/product/product.html',
        controller: 'ProductCtrl',
        resolve: {
            theProduct: function theProduct(ProductFactory, $stateParams) {
                return ProductFactory.fetchById($stateParams.productId);
            },
            allReviews: function allReviews(ProductFactory, $stateParams) {
                return ProductFactory.fetchAllReviews($stateParams.productId);
            }
        }
    });
});

app.config(function ($stateProvider) {

    $stateProvider.state('signup', {
        url: '/signup',
        templateUrl: 'js/signup/signup.html',
        controller: 'SignupCtrl'
    });
});

app.controller('SignupCtrl', function ($scope, AuthFactory, $state) {
    $scope.signup = {};
    $scope.sendSignup = function (signupInfo) {
        AuthFactory.signup(signupInfo).then(function (response) {
            if (response === 'email exists already') {
                Materialize.toast('User already exists', 2000);
            } else {
                $state.go('store');
            }
        });
    };
    $scope.googleSignup = AuthFactory.googleSignup;
});

app.controller('StoreCtrl', function ($scope, products) {
    $scope.products = products;
});

app.config(function ($stateProvider) {
    $stateProvider.state('store', {
        url: '/store',
        templateUrl: 'js/store/store.html',
        controller: 'StoreCtrl',
        resolve: {
            products: function products(ProductFactory) {
                return ProductFactory.fetchAll();
            }
        }
    });
});

app.factory('FullstackPics', function () {
    return ['https://pbs.twimg.com/media/B7gBXulCAAAXQcE.jpg:large', 'https://fbcdn-sphotos-c-a.akamaihd.net/hphotos-ak-xap1/t31.0-8/10862451_10205622990359241_8027168843312841137_o.jpg', 'https://pbs.twimg.com/media/B-LKUshIgAEy9SK.jpg', 'https://pbs.twimg.com/media/B79-X7oCMAAkw7y.jpg', 'https://pbs.twimg.com/media/B-Uj9COIIAIFAh0.jpg:large', 'https://pbs.twimg.com/media/B6yIyFiCEAAql12.jpg:large', 'https://pbs.twimg.com/media/CE-T75lWAAAmqqJ.jpg:large', 'https://pbs.twimg.com/media/CEvZAg-VAAAk932.jpg:large', 'https://pbs.twimg.com/media/CEgNMeOXIAIfDhK.jpg:large', 'https://pbs.twimg.com/media/CEQyIDNWgAAu60B.jpg:large', 'https://pbs.twimg.com/media/CCF3T5QW8AE2lGJ.jpg:large', 'https://pbs.twimg.com/media/CAeVw5SWoAAALsj.jpg:large', 'https://pbs.twimg.com/media/CAaJIP7UkAAlIGs.jpg:large', 'https://pbs.twimg.com/media/CAQOw9lWEAAY9Fl.jpg:large', 'https://pbs.twimg.com/media/B-OQbVrCMAANwIM.jpg:large', 'https://pbs.twimg.com/media/B9b_erwCYAAwRcJ.png:large', 'https://pbs.twimg.com/media/B5PTdvnCcAEAl4x.jpg:large', 'https://pbs.twimg.com/media/B4qwC0iCYAAlPGh.jpg:large', 'https://pbs.twimg.com/media/B2b33vRIUAA9o1D.jpg:large', 'https://pbs.twimg.com/media/BwpIwr1IUAAvO2_.jpg:large', 'https://pbs.twimg.com/media/BsSseANCYAEOhLw.jpg:large', 'https://pbs.twimg.com/media/CJ4vLfuUwAAda4L.jpg:large', 'https://pbs.twimg.com/media/CI7wzjEVEAAOPpS.jpg:large', 'https://pbs.twimg.com/media/CIdHvT2UsAAnnHV.jpg:large', 'https://pbs.twimg.com/media/CGCiP_YWYAAo75V.jpg:large', 'https://pbs.twimg.com/media/CIS4JPIWIAI37qu.jpg:large'];
});

app.factory('OrderHistoriesFactory', function ($http) {

    var cachedCart = [];
    var baseUrl = '/api/orders/paid/';
    var orderHistoriesFactory = {};
    var getData = function getData(res) {
        return res.data;
    };

    orderHistoriesFactory.fetchAll = function () {
        return $http.get(baseUrl).then(function (response) {
            angular.copy(response.data, cachedCart);
            return cachedCart;
        });
    };

    return orderHistoriesFactory;
});

app.factory('RandomGreetings', function () {

    var getRandomFromArray = function getRandomFromArray(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    };

    var greetings = ['Hello, world!', 'At long last, I live!', 'Hello, simple human.', 'What a beautiful day!', 'I\'m like any other project, except that I am yours. :)', 'This empty string is for Lindsay Levine.', 'こんにちは、ユーザー様。', 'Welcome. To. WEBSITE.', ':D', 'Yes, I think we\'ve met before.', 'Gimme 3 mins... I just grabbed this really dope frittata', 'If Cooper could offer only one piece of advice, it would be to nevSQUIRREL!'];

    return {
        greetings: greetings,
        getRandomGreeting: function getRandomGreeting() {
            return getRandomFromArray(greetings);
        }
    };
});

app.factory('AuthFactory', function ($http) {

    var getData = function getData(res) {
        return res.data;
    };

    var AuthFactory = {};

    AuthFactory.signup = function (signupInfo) {
        return $http.post('/signup', signupInfo).then(getData);
    };

    AuthFactory.googleSignup = function () {
        return $http.get('/auth/google');
    };

    AuthFactory.resetPassword = function (token, login) {
        return $http.post('/reset/password/' + token, login);
    };

    AuthFactory.forgetPassword = function (email) {
        return $http.post('/forgot', email);
    };

    return AuthFactory;
});

app.factory('CartFactory', function ($http, $log, $state, $rootScope) {

    var getData = function getData(res) {
        return res.data;
    };
    var baseUrl = '/api/orders/cart/';
    var convert = function convert(item) {
        item.imageUrl = '/api/products/' + item.productId + '/image';
        return item;
    };
    var CartFactory = {};
    CartFactory.cachedCart = [];

    CartFactory.fetchAllFromCart = function () {
        return $http.get(baseUrl).then(function (response) {
            angular.copy(response.data, CartFactory.cachedCart);
            return CartFactory.cachedCart.sort(function (a, b) {
                return b.id - a.id;
            });
        }).then(function (items) {
            CartFactory.cachedCart = items.map(convert);
            $rootScope.$emit('updateCart', CartFactory.cachedCart);
            return items.map(convert);
        });
    };

    CartFactory.deleteItem = function (productId) {
        return $http.delete(baseUrl + productId).then(function (response) {
            angular.copy(response.data, CartFactory.cachedCart);
            return CartFactory.cachedCart;
        });
    };

    CartFactory.checkForDuplicates = function (productId) {
        var duplicate = this.cachedCart.filter(function (item) {
            return item.productId === productId;
        });
        return duplicate.length ? duplicate[0] : null;
    };

    CartFactory.addToCart = function (productId, quantity) {
        var duplicate = CartFactory.checkForDuplicates(productId);
        if (duplicate) {
            return CartFactory.changeQuantity(duplicate.id, duplicate.quantity, 'add', quantity);
        } else {
            addSuccessAnimation();
            return $http.post(baseUrl + productId, { quantity: quantity }).then(function (response) {
                var item = response.data;
                CartFactory.cachedCart.push(item);
                return item;
            });
            // .then(convert)
        }
    };

    CartFactory.removeFromCart = function (orderId) {
        addRemoveAnimation();
        return $http.delete(baseUrl + orderId).success(function () {
            CartFactory.removeFromFrontEndCache(orderId);
        }).then(function () {
            return CartFactory.cachedCart;
        });
    };
    CartFactory.changeQuantity = function (orderId, quantity, addOrSubtr) {
        var amount = arguments.length <= 3 || arguments[3] === undefined ? 1 : arguments[3];

        var runFunc = false;
        if (addOrSubtr === 'add') {
            addSuccessAnimation();
            quantity += +amount;
            runFunc = true;
        } else if (addOrSubtr === 'subtract' && quantity > 1) {
            addRemoveAnimation();
            quantity -= +amount;
            runFunc = true;
        }
        if (runFunc === true) {
            return $http.put(baseUrl + orderId, { quantity: quantity })
            // .then(convert)
            .then(function () {
                CartFactory.changeFrontEndCacheQuantity(orderId, quantity);
            });
        }
    };

    CartFactory.removeFromFrontEndCache = function (orderId) {
        var index;
        CartFactory.cachedCart.forEach(function (order, i) {
            if (order.id === orderId) index = i;
        });

        CartFactory.cachedCart.splice(index, 1);
    };

    CartFactory.changeFrontEndCacheQuantity = function (orderId, quantity) {
        var i = CartFactory.cachedCart.findIndex(function (order) {
            // if (order.id === orderId) {
            //     order.quantity = quantity;
            // }
            return order.id === orderId;
        });
        CartFactory.cachedCart[i].quantity = quantity;
    };

    CartFactory.checkout = function () {
        return $http.get(baseUrl + 'checkout').then(function () {
            $state.go('orderHistories');
            CartFactory.cachedCart.splice(0, CartFactory.cachedCart.length);
        }).catch(function () {
            Materialize.toast('Oops, Something went wrong', 1000);
        });
    };

    CartFactory.getTotalCost = function () {
        var total = 0;
        return CartFactory.fetchAllFromCart().then(function (cart) {
            console.log(cart);
            cart.forEach(function (item) {
                return total += item.price * item.quantity;
            });
            console.log('tota', total);
            return total;
        }).catch($log.error);
    };

    var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';

    function addSuccessAnimation() {
        $('#cart-icon').addClass('animated rubberBand').one(animationEnd, function () {
            $('#cart-icon').removeClass('animated rubberBand');
        });
    }

    function addRemoveAnimation() {
        $('#cart-icon').addClass('animated shake').one(animationEnd, function () {
            $('#cart-icon').removeClass('animated shake');
        });
    }

    return CartFactory;
});

app.factory('ManageOrdersFactory', function ($http) {

    var cachedOrderDetails = [];
    var cachedUserOrders = [];
    var baseUrl = '/api/manageOrders/';
    var manageOrdersFactory = {};
    var getData = function getData(res) {
        return res.data;
    };

    manageOrdersFactory.fetchAll = function () {
        return $http.get(baseUrl).then(function (response) {
            angular.copy(response.data, cachedOrderDetails);
            return cachedOrderDetails;
        });
    };

    manageOrdersFactory.fetchAllUserOrders = function () {
        return $http.get(baseUrl + 'userOrder').then(function (response) {
            angular.copy(response.data, cachedUserOrders);
            return cachedUserOrders;
        });
    };

    manageOrdersFactory.findStatus = function (userOrderId) {
        return $http.get(baseUrl + 'userOrder/' + userOrderId).then(getData);
    };

    manageOrdersFactory.findUser = function (userOrderId) {
        return $http.get(baseUrl + 'user/' + userOrderId).then(getData);
    };

    manageOrdersFactory.updateStatus = function (userOrderId, data) {
        return $http.put(baseUrl + 'userOrder/' + userOrderId, data).then(getData).then(function (userOrder) {
            Materialize.toast("Updated", 1000);
            var updatedInd = cachedUserOrders.findIndex(function (userOrder) {
                return userOrder.id === userOrderId;
            });
            cachedUserOrders[updatedInd] = userOrder;
            return userOrder;
        });
    };
    manageOrdersFactory.deleteUserOrder = function (userOrderId) {
        return $http.delete(baseUrl + 'userOrder/' + userOrderId).success(function () {
            Materialize.toast("Deleted", 1000);
            var deletedInd = cachedUserOrders.findIndex(function (userOrder) {
                return userOrder.id === userOrderId;
            });
            cachedUserOrders.splice(deletedInd, 1);
        });
    };

    return manageOrdersFactory;
});

app.factory('ProductFactory', function ($http) {

    var baseUrl = '/api/products/';
    var getData = function getData(res) {
        return res.data;
    };
    var parseTimeStr = function parseTimeStr(review) {
        var date = review.createdAt.substr(0, 10);
        review.date = date;
        return review;
    };

    var ProductFactory = {};
    ProductFactory.cachedProducts = [];
    ProductFactory.cachedReviews = [];

    ProductFactory.fetchAll = function () {
        return $http.get(baseUrl).then(getData).then(function (products) {
            return products.map(ProductFactory.convert);
        }).then(function (products) {
            angular.copy(products, ProductFactory.cachedProducts); // why angular copy alters array order!!!!!!!
            ProductFactory.cachedProducts.sort(function (a, b) {
                return a.id - b.id;
            });
            return ProductFactory.cachedProducts;
        });
    };

    ProductFactory.updateProduct = function (id, data) {
        return $http.put(baseUrl + id, data).then(getData).then(ProductFactory.convert).then(function (product) {
            Materialize.toast('Updated', 1000);
            var updatedInd = ProductFactory.cachedProducts.findIndex(function (product) {
                return product.id === id;
            });
            ProductFactory.cachedProducts[updatedInd] = product;
            return product;
        });
    };

    ProductFactory.deleteProduct = function (id) {
        return $http.delete(baseUrl + id).success(function () {
            Materialize.toast('Deleted', 1000);
            var deletedInd = ProductFactory.cachedProducts.findIndex(function (product) {
                return product.id === id;
            });
            ProductFactory.cachedProducts.splice(deletedInd, 1);
        });
    };

    ProductFactory.fetchById = function (id) {
        return $http.get(baseUrl + id).then(getData).then(ProductFactory.convert);
    };

    ProductFactory.convert = function (product) {
        product.imageUrl = baseUrl + product.id + '/image';
        return product;
    };

    ProductFactory.createReview = function (productId, data) {
        return $http.post('/api/reviews/' + productId, data).then(function (response) {
            var review = parseTimeStr(response.data);
            ProductFactory.cachedReviews.push(review);
            return review;
        });
    };

    ProductFactory.fetchAllReviews = function (productId) {
        return $http.get('/api/reviews/' + productId).then(function (response) {
            angular.copy(response.data, ProductFactory.cachedReviews);
            return ProductFactory.cachedReviews.map(parseTimeStr);
        });
    };

    return ProductFactory;
});

app.factory('UserFactory', function ($http) {
    var UserFactory = {};

    var cachedUsers = [];
    var baseUrl = '/api/users/';
    var getData = function getData(res) {
        return res.data;
    };

    UserFactory.fetchAll = function () {
        return $http.get(baseUrl).then(getData).then(function (users) {
            angular.copy(users, cachedUsers); // why angular copy alters array order!!!!!!!
            cachedUsers.sort(function (a, b) {
                return a.id - b.id;
            });
            return cachedUsers;
        });
    };

    UserFactory.updateUser = function (id, data) {
        return $http.put(baseUrl + id, data).then(getData).then(function (user) {
            var updatedInd = cachedUsers.findIndex(function (user) {
                return user.id === id;
            });
            cachedUsers[updatedInd] = user;
            return user;
        });
    };

    UserFactory.deleteUser = function (id) {
        return $http.delete(baseUrl + id).success(function () {
            var deletedInd = cachedUsers.findIndex(function (user) {
                return user.id === id;
            });
            cachedUsers.splice(deletedInd, 1);
        });
    };

    UserFactory.updateUserBeforePayment = function (infoObj) {
        return $http.get(baseUrl + 'getLoggedInUserId').then(getData).then(function (user) {
            if (user.id === 'session') {
                return $http.put('api/orders/cart/updateSessionCart', infoObj);
            } else {
                return UserFactory.updateUser(user.id, infoObj).then(function () {
                    return $http.put('api/orders/cart/updateUserCart', infoObj);
                });
            }
        });
    };

    return UserFactory;
});

app.directive('shoppingCart', function (CartFactory, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/cart-reveal/cart-reveal.html',
        scope: {
            active: '='
        },
        link: function link(scope, elem, attr) {
            scope.showCart = 'checkout';
            CartFactory.fetchAllFromCart().then(function (cart) {
                scope.cart = CartFactory.cachedCart;
            });
            $rootScope.$on('updateCart', function (event, cart) {
                scope.cart = cart;
            });
            scope.revealCart = function () {
                scope.showCart = 'checkout checkout--active';
            };
            scope.hideCart = function () {
                scope.active = 'inactive';
                scope.showCart = 'checkout';
            };
            scope.total = function () {
                var total = 0;
                if (scope.cart) scope.cart.forEach(function (item) {
                    return total += item.price * item.quantity;
                });
                return total;
            };
        }
    };
});

app.directive('fullstackLogo', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/fullstack-logo/fullstack-logo.html'
    };
});
app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            scope.items = [{ label: 'Shop', state: 'store' }];

            scope.toggleLogo = function () {
                $('.pokeball i.great').css('background-position', '-297px -306px');
            };

            scope.untoggleLogo = function () {
                $('.pokeball i.great').css('background-position', '-293px -9px');
            };

            scope.user = null;
            scope.admin = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                    $state.go('home');
                });
            };

            var setUser = function setUser() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function removeUser() {
                scope.user = null;
            };

            var setAdmin = function setAdmin() {
                // console.log(AuthInterceptor);
                AuthService.getLoggedInUser().then(function (user) {
                    scope.admin = AuthService.isAdmin(user);
                });
            };

            setUser();
            setAdmin();

            $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
            $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
        }

    };
});

'use strict';

app.directive('oauthButton', function () {
    return {
        scope: {
            providerName: '@'
        },
        restrict: 'E',
        templateUrl: '/js/common/directives/oauth-button/oauth-button.html'
    };
});

app.directive('orderEntry', function (ManageOrdersFactory) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/order-entry/order-entry.html',
        scope: {
            orderDetails: '='
        },
        link: function link(s, e, a) {
            console.log(s.orderDetails);
        }
    };
});

app.controller('OrderHistoryCtrl', function ($scope) {});
app.directive('orderHistory', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/order-history/order-history.html',
        scope: {
            histories: '='
        },
        controller: 'OrderHistoryCtrl'
    };
});

app.controller('ProductCardCtrl', function ($scope) {

    $scope.categories = [{ name: 'All' }, { name: 'Fire' }, { name: 'Water' }, { name: 'Grass' }, { name: 'Rock' }, { name: 'Dragon' }, { name: 'Psychic' }, { name: 'Ice' }, { name: 'Normal' }, { name: 'Bug' }, { name: 'Electric' }, { name: 'Ground' }, { name: 'Fairy' }, { name: 'Fighting' }, { name: 'Ghost' }, { name: 'Poison' }];

    $scope.filter = function (category) {
        return function (product) {
            if (!category || category === 'All') return true;else return product.category === category;
        };
    };
    $scope.searchFilter = function (searchingName) {
        return function (product) {
            if (!searchingName) return true;else {
                var len = searchingName.length;
                console.log('product', product.title);
                return product.title.substring(0, len).toLowerCase() == searchingName.toLowerCase();
            }
        };
    };
    $scope.priceRangeFilter = function () {
        var min = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];
        var max = arguments.length <= 1 || arguments[1] === undefined ? 2000 : arguments[1];

        return function (product) {
            return product.price >= min && product.price <= max;
        };
    };
    $scope.sortingFunc = function () {
        var sortType = arguments.length <= 0 || arguments[0] === undefined ? "untouched" : arguments[0];

        if (sortType === "untouched") return null;else if (sortType === "low") return 'price';else if (sortType === 'high') return '-price';
    };
});

app.directive('productCard', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/product-card/product-card.html',
        scope: {
            products: '='
        },
        controller: 'ProductCardCtrl'
    };
});

app.directive('productEntry', function (ProductFactory) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/product-entry/product-entry.html',
        scope: {
            product: '=',
            ngModel: '='
        },
        link: function link(scope, elem, attr) {
            scope.submitUpdate = function (id) {
                ProductFactory.updateProduct(id, scope.ngModel);
            };
            scope.deleteProduct = function (id) {
                ProductFactory.deleteProduct(id);
            };
        }
    };
});

app.directive('randoGreeting', function (RandomGreetings) {

    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/rando-greeting/rando-greeting.html',
        link: function link(scope) {
            scope.greeting = RandomGreetings.getRandomGreeting();
        }
    };
});
// app.directive('starRating', function () {
//     return {
//       restrict: 'EA',
//       template:
//         '<span class="stars">' +
//          '<div class="stars-filled left">' +
//             '<span>★</span>' +
//          '</div>' +
//       '</span>'
//     };
// })

// app.controller('SearchBarCtrl', function($scope){
// 	$scope.product=
// })
app.directive('searchBar', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/search-bar/search-bar.html',
        controller: 'ProductCardCtrl'
    };
});

app.directive('userEntry', function (UserFactory, AuthFactory) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/user-entry/user-entry.html',
        scope: {
            user: '=',
            ngModel: '='
        },
        link: function link(scope, elem, attr) {
            scope.forgetPassword = function (email) {
                AuthFactory.forgetPassword({ email: email }).then(function () {
                    Materialize.toast('Done', 1000);
                }).catch(function () {
                    Materialize.toast('Oops, something went wrong', 1000);
                });
            };
            scope.deleteUser = function (userId) {
                UserFactory.deleteUser(userId).then(function () {
                    Materialize.toast('Erase from planet Earth', 1000);
                }).catch(function () {
                    Materialize.toast('Oops, something went wrong', 1000);
                });
            };
        }
    };
});

app.directive('userOrder', function (ManageOrdersFactory) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/user-order/user-order.html',
        scope: {
            userOrder: '=',
            ngModel: '='
        },
        link: function link(scope, elem, attr) {
            scope.updateStatus = function (id) {
                ManageOrdersFactory.updateStatus(id, scope.ngModel);
            };
            scope.deleteUserOrder = function (id) {
                ManageOrdersFactory.deleteUserOrder(id);
            };
        }
    };
});

app.directive('clickAnywhereButHere', function ($document) {
    return {
        restrict: 'A',
        scope: {
            clickAnywhereButHere: '&'
        },
        link: function link(scope, el, attr) {

            $('.logo').on('click', function (e) {
                e.stopPropagation();
            });

            $document.on('click', function (e) {
                if (e.target.id !== 'cart-icon' && e.target.id !== 'add-to-cart-button') {
                    if (el !== e.target && !el[0].contains(e.target)) {
                        scope.$apply(function () {

                            scope.$eval(scope.clickAnywhereButHere);
                        });
                    }
                }
            });
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFib3V0L2Fib3V0LmpzIiwiYWRtaW4vYWRtaW4uY29udHJvbGxlci5qcyIsImFkbWluL2FkbWluLmpzIiwiY2FydC9jYXJ0LmNvbnRyb2xsZXIuanMiLCJjYXJ0L2NhcnQuanMiLCJjaGVja291dC9jaGVja291dC5jb250cm9sbGVyLmpzIiwiY2hlY2tvdXQvY2hlY2tvdXQuanMiLCJmc2EvZnNhLXByZS1idWlsdC5qcyIsImhpc3Rvcnkvb3JkZXJIaXN0b3JpZXMuY29udHJvbGxlci5qcyIsImhpc3Rvcnkvb3JkZXJIaXN0b3JpZXMuanMiLCJob21lL2FuaW1hdGlvbi5kaXJlY3RpdmUuanMiLCJob21lL2hvbWUuanMiLCJsb2dpbi9sb2dpbi5qcyIsIm1lbWJlcnMtb25seS9tZW1iZXJzLW9ubHkuanMiLCJwYXltZW50L3BheW1lbnQuY29udHJvbGxlci5qcyIsInBheW1lbnQvcGF5bWVudC5qcyIsInByb2R1Y3QvcHJvZHVjdC5jb250cm9sbGVyLmpzIiwicHJvZHVjdC9wcm9kdWN0LmpzIiwic2lnbnVwL3NpZ251cC5qcyIsInN0b3JlL3N0b3JlLmNvbnRyb2xsZXIuanMiLCJzdG9yZS9zdG9yZS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvRnVsbHN0YWNrUGljcy5qcyIsImNvbW1vbi9mYWN0b3JpZXMvT3JkZXJIaXN0b3JpZXMuZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvUmFuZG9tR3JlZXRpbmdzLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9hdXRoLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL2NhcnQuZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvbWFuYWdlT3JkZXJzLmZhY3RvcnkuanMiLCJjb21tb24vZmFjdG9yaWVzL3Byb2R1Y3QuZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvdXNlci5mYWN0b3J5LmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvY2FydC1yZXZlYWwvY2FydC1yZXZlYWwuanMiLCJjb21tb24vZGlyZWN0aXZlcy9mdWxsc3RhY2stbG9nby9mdWxsc3RhY2stbG9nby5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJjb21tb24vZGlyZWN0aXZlcy9vYXV0aC1idXR0b24vb2F1dGgtYnV0dG9uLmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL29yZGVyLWVudHJ5L29yZGVyLWVudHJ5LmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL29yZGVyLWhpc3Rvcnkvb3JkZXItaGlzdG9yeS5jb250cm9sbGVyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvb3JkZXItaGlzdG9yeS9vcmRlci1oaXN0b3J5LmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3Byb2R1Y3QtY2FyZC9wcm9kdWN0LWNhcmQuY29udHJvbGxlci5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3Byb2R1Y3QtY2FyZC9wcm9kdWN0LWNhcmQuZGlyZWN0aXZlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvcHJvZHVjdC1lbnRyeS9wcm9kdWN0LWVudHJ5LmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3JhbmRvLWdyZWV0aW5nL3JhbmRvLWdyZWV0aW5nLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvcmV2aWV3LWVudHJ5L3N0YXItcmF0aW5nLmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3NlYXJjaC1iYXIvc2VhcmNoLWJhci5jb250cm9sbGVyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvc2VhcmNoLWJhci9zZWFyY2gtYmFyLmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3VzZXItZW50cnkvdXNlci1lbnRyeS5kaXJlY3RpdmUuanMiLCJjb21tb24vZGlyZWN0aXZlcy91c2VyLW9yZGVyL3VzZXItb3JkZXIuZGlyZWN0aXZlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvdXRpbGl0eS9jbGlja0FueXdoZXJlQnV0SGVyZS5kaXJlY3RpdmUuanMiXSwibmFtZXMiOlsid2luZG93IiwiYXBwIiwiYW5ndWxhciIsIm1vZHVsZSIsImNvbmZpZyIsIiR1cmxSb3V0ZXJQcm92aWRlciIsIiRsb2NhdGlvblByb3ZpZGVyIiwiJHVpVmlld1Njcm9sbFByb3ZpZGVyIiwic3RyaXBlUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJ1c2VBbmNob3JTY3JvbGwiLCJydW4iLCIkcm9vdFNjb3BlIiwiQXV0aFNlcnZpY2UiLCIkc3RhdGUiLCJkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoIiwic3RhdGUiLCJkYXRhIiwiYXV0aGVudGljYXRlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJpc0F1dGhlbnRpY2F0ZWQiLCJwcmV2ZW50RGVmYXVsdCIsImdldExvZ2dlZEluVXNlciIsInRoZW4iLCJ1c2VyIiwiZ28iLCJuYW1lIiwiJHN0YXRlUHJvdmlkZXIiLCJ1cmwiLCJjb250cm9sbGVyIiwidGVtcGxhdGVVcmwiLCIkc2NvcGUiLCJGdWxsc3RhY2tQaWNzIiwiaW1hZ2VzIiwiXyIsInNodWZmbGUiLCJhbGxVc2VyT3JkZXJzIiwiJGxvZyIsImFsbFByb2R1Y3RzIiwiYWxsVXNlcnMiLCJhbGxPcmRlckRldGFpbHMiLCJNYW5hZ2VPcmRlcnNGYWN0b3J5IiwicHJvZHVjdHMiLCJ1c2VycyIsInVzZXJPcmRlcnMiLCJmb3JFYWNoIiwib3JkZXJEZXRhaWwiLCJmaW5kU3RhdHVzIiwidXNlck9yZGVySWQiLCJzdGF0dXMiLCJjYXRjaCIsImVycm9yIiwiZmluZFVzZXIiLCJzb3J0IiwiYSIsImIiLCJncm91cEJ5Iiwib3JkZXJzIiwiJCIsIm1hcCIsIm9yZGVyIiwiaSIsImNvbnNvbGUiLCJsb2ciLCJyZXNvbHZlIiwiUHJvZHVjdEZhY3RvcnkiLCJmZXRjaEFsbCIsIlVzZXJGYWN0b3J5IiwiZmV0Y2hBbGxVc2VyT3JkZXJzIiwiY2FydENvbnRlbnQiLCJDYXJ0RmFjdG9yeSIsInJlbW92ZSIsIm9yZGVySWQiLCJyZW1vdmVGcm9tQ2FydCIsIm5ld0NhcnQiLCJjaGFuZ2VRdWFudGl0eSIsImNhcnRJZCIsInF1YW50aXR5IiwiYWRkT3JTdWJ0cmFjdCIsImNhY2hlZENhcnQiLCJjaGVja291dCIsInRvdGFsIiwiY2FydCIsInByaWNlIiwiZmV0Y2hBbGxGcm9tQ2FydCIsIml0ZW1zIiwiaXRlbXNBcnIiLCJ0b3RhbFByaWNlRWFjaCIsImVsZW1lbnQiLCJwdXNoIiwicmVkdWNlIiwicHJldiIsImN1cnIiLCJFcnJvciIsImZhY3RvcnkiLCJpbyIsIm9yaWdpbiIsImNvbnN0YW50IiwibG9naW5TdWNjZXNzIiwibG9naW5GYWlsZWQiLCJsb2dvdXRTdWNjZXNzIiwic2Vzc2lvblRpbWVvdXQiLCJub3RBdXRoZW50aWNhdGVkIiwibm90QXV0aG9yaXplZCIsIiRxIiwiQVVUSF9FVkVOVFMiLCJzdGF0dXNEaWN0IiwicmVzcG9uc2VFcnJvciIsInJlc3BvbnNlIiwiJGJyb2FkY2FzdCIsInJlamVjdCIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCIkaW5qZWN0b3IiLCJnZXQiLCJzZXJ2aWNlIiwiJGh0dHAiLCJTZXNzaW9uIiwib25TdWNjZXNzZnVsTG9naW4iLCJjcmVhdGUiLCJpZCIsImlzQWRtaW4iLCJmcm9tU2VydmVyIiwibG9naW4iLCJjcmVkZW50aWFscyIsInBvc3QiLCJtZXNzYWdlIiwibG9nb3V0IiwiZGVzdHJveSIsInNlbGYiLCJzZXNzaW9uSWQiLCJPcmRlckhpc3Rvcmllc0ZhY3RvcnkiLCJ1c2VyT3JkZXJzQXJyIiwicGFpZEl0ZW1zIiwiYXJyIiwiZGF0ZSIsIkRhdGUiLCJ0b1N0cmluZyIsImRpcmVjdGl2ZSIsImFuaW1hdGlvbkVuZEV2ZW50cyIsImNyZWF0ZUNoYXJhY3RlcnMiLCJjaGFyYWN0ZXJzIiwiYXNoIiwib3RoZXJzIiwiZ2V0WSIsIk1hdGgiLCJyYW5kb20iLCJ0b0ZpeGVkIiwiZ2V0WiIsInkiLCJmbG9vciIsInJhbmRvbUNoYXJhY3RlcnMiLCJ3aG8iLCJsZW5ndGgiLCJtYWtlQ2hhcmFjdGVyIiwieERlbGF5IiwiZGVsYXkiLCJjaGFyYWN0ZXIiLCJib3R0b20iLCJ6Iiwic3R5bGUiLCJob3JkZSIsImoiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwiaW5uZXJIVE1MIiwicmVzdHJpY3QiLCJ0ZW1wbGF0ZSIsImNvbXBpbGUiLCJwcmUiLCJhZGRDbGFzcyIsIm9uIiwiZSIsInNjb3BlIiwiQXV0aEZhY3RvcnkiLCIkc3RhdGVQYXJhbXMiLCJ0b2tlbiIsImZvcmdldFBhc3N3b3JkIiwiZW1haWwiLCJNYXRlcmlhbGl6ZSIsInRvYXN0IiwicmVzZXRQYXNzd29yZCIsInBhc3N3b3JkIiwic2VuZExvZ2luIiwibG9naW5JbmZvIiwiU2VjcmV0U3Rhc2giLCJnZXRTdGFzaCIsInN0YXNoIiwidG90YWxDb3N0IiwiYXJyYXlPZkl0ZW1zIiwiaW5mbyIsInZhbGlkYXRlVXNlciIsInVwZGF0ZVVzZXJCZWZvcmVQYXltZW50Iiwic2hvd0NDIiwic3RyaW5nT2ZJdGVtcyIsIml0ZW0iLCJ0aXRsZSIsImpvaW4iLCJnZXRUb3RhbENvc3QiLCJ0aGVQcm9kdWN0IiwiYWxsUmV2aWV3cyIsIm5ld1JldmlldyIsInByb2R1Y3QiLCJyZXZpZXdzIiwibW9kYWxPcGVuIiwic3VibWl0UmV2aWV3IiwicHJvZHVjdElkIiwiY3JlYXRlUmV2aWV3IiwiY2FjaGVkUmV2aWV3cyIsImFkZFRvQ2FydCIsImFycmF5TWFrZXIiLCJudW0iLCJhdXRvc2Nyb2xsIiwiZmV0Y2hCeUlkIiwiZmV0Y2hBbGxSZXZpZXdzIiwic2lnbnVwIiwic2VuZFNpZ251cCIsInNpZ251cEluZm8iLCJnb29nbGVTaWdudXAiLCJiYXNlVXJsIiwib3JkZXJIaXN0b3JpZXNGYWN0b3J5IiwiZ2V0RGF0YSIsInJlcyIsImNvcHkiLCJnZXRSYW5kb21Gcm9tQXJyYXkiLCJncmVldGluZ3MiLCJnZXRSYW5kb21HcmVldGluZyIsImNvbnZlcnQiLCJpbWFnZVVybCIsIiRlbWl0IiwiZGVsZXRlSXRlbSIsImRlbGV0ZSIsImNoZWNrRm9yRHVwbGljYXRlcyIsImR1cGxpY2F0ZSIsImZpbHRlciIsImFkZFN1Y2Nlc3NBbmltYXRpb24iLCJhZGRSZW1vdmVBbmltYXRpb24iLCJzdWNjZXNzIiwicmVtb3ZlRnJvbUZyb250RW5kQ2FjaGUiLCJhZGRPclN1YnRyIiwiYW1vdW50IiwicnVuRnVuYyIsInB1dCIsImNoYW5nZUZyb250RW5kQ2FjaGVRdWFudGl0eSIsImluZGV4Iiwic3BsaWNlIiwiZmluZEluZGV4IiwiYW5pbWF0aW9uRW5kIiwib25lIiwicmVtb3ZlQ2xhc3MiLCJjYWNoZWRPcmRlckRldGFpbHMiLCJjYWNoZWRVc2VyT3JkZXJzIiwibWFuYWdlT3JkZXJzRmFjdG9yeSIsInVwZGF0ZVN0YXR1cyIsInVzZXJPcmRlciIsInVwZGF0ZWRJbmQiLCJkZWxldGVVc2VyT3JkZXIiLCJkZWxldGVkSW5kIiwicGFyc2VUaW1lU3RyIiwicmV2aWV3IiwiY3JlYXRlZEF0Iiwic3Vic3RyIiwiY2FjaGVkUHJvZHVjdHMiLCJ1cGRhdGVQcm9kdWN0IiwiZGVsZXRlUHJvZHVjdCIsImNhY2hlZFVzZXJzIiwidXBkYXRlVXNlciIsImRlbGV0ZVVzZXIiLCJpbmZvT2JqIiwiYWN0aXZlIiwibGluayIsImVsZW0iLCJhdHRyIiwic2hvd0NhcnQiLCJyZXZlYWxDYXJ0IiwiaGlkZUNhcnQiLCJsYWJlbCIsInRvZ2dsZUxvZ28iLCJjc3MiLCJ1bnRvZ2dsZUxvZ28iLCJhZG1pbiIsImlzTG9nZ2VkSW4iLCJzZXRVc2VyIiwicmVtb3ZlVXNlciIsInNldEFkbWluIiwicHJvdmlkZXJOYW1lIiwib3JkZXJEZXRhaWxzIiwicyIsImhpc3RvcmllcyIsImNhdGVnb3JpZXMiLCJjYXRlZ29yeSIsInNlYXJjaEZpbHRlciIsInNlYXJjaGluZ05hbWUiLCJsZW4iLCJzdWJzdHJpbmciLCJ0b0xvd2VyQ2FzZSIsInByaWNlUmFuZ2VGaWx0ZXIiLCJtaW4iLCJtYXgiLCJzb3J0aW5nRnVuYyIsInNvcnRUeXBlIiwibmdNb2RlbCIsInN1Ym1pdFVwZGF0ZSIsIlJhbmRvbUdyZWV0aW5ncyIsImdyZWV0aW5nIiwidXNlcklkIiwiJGRvY3VtZW50IiwiY2xpY2tBbnl3aGVyZUJ1dEhlcmUiLCJlbCIsInN0b3BQcm9wYWdhdGlvbiIsInRhcmdldCIsImNvbnRhaW5zIiwiJGFwcGx5IiwiJGV2YWwiXSwibWFwcGluZ3MiOiJBQUFBOztBQUVBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxFQUFBLGdCQUFBLEVBQUEscUJBQUEsRUFBQSxnQkFBQSxDQUFBLENBQUE7O0FBRUFGLElBQUFHLE1BQUEsQ0FBQSxVQUFBQyxrQkFBQSxFQUFBQyxpQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxjQUFBLEVBQUE7QUFDQTtBQUNBRixzQkFBQUcsU0FBQSxDQUFBLElBQUE7QUFDQTtBQUNBSix1QkFBQUssU0FBQSxDQUFBLEdBQUE7QUFDQTtBQUNBTCx1QkFBQU0sSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBWCxlQUFBWSxRQUFBLENBQUFDLE1BQUE7QUFDQSxLQUZBO0FBR0FOLDBCQUFBTyxlQUFBOztBQUVBO0FBRUEsQ0FiQTs7QUFlQTtBQUNBYixJQUFBYyxHQUFBLENBQUEsVUFBQUMsVUFBQSxFQUFBQyxXQUFBLEVBQUFDLE1BQUEsRUFBQTs7QUFFQTtBQUNBLFFBQUFDLCtCQUFBLFNBQUFBLDRCQUFBLENBQUFDLEtBQUEsRUFBQTtBQUNBLGVBQUFBLE1BQUFDLElBQUEsSUFBQUQsTUFBQUMsSUFBQSxDQUFBQyxZQUFBO0FBQ0EsS0FGQTs7QUFJQTtBQUNBO0FBQ0FOLGVBQUFPLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUFDLEtBQUEsRUFBQUMsT0FBQSxFQUFBQyxRQUFBLEVBQUE7O0FBRUEsWUFBQSxDQUFBUCw2QkFBQU0sT0FBQSxDQUFBLEVBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxZQUFBUixZQUFBVSxlQUFBLEVBQUEsRUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0FILGNBQUFJLGNBQUE7O0FBRUFYLG9CQUFBWSxlQUFBLEdBQUFDLElBQUEsQ0FBQSxVQUFBQyxJQUFBLEVBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBQUEsSUFBQSxFQUFBO0FBQ0FiLHVCQUFBYyxFQUFBLENBQUFQLFFBQUFRLElBQUEsRUFBQVAsUUFBQTtBQUNBLGFBRkEsTUFFQTtBQUNBUix1QkFBQWMsRUFBQSxDQUFBLE9BQUE7QUFDQTtBQUNBLFNBVEE7QUFXQSxLQTVCQTtBQThCQSxDQXZDQTs7QUNwQkEvQixJQUFBRyxNQUFBLENBQUEsVUFBQThCLGNBQUEsRUFBQTs7QUFFQTtBQUNBQSxtQkFBQWQsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBZSxhQUFBLFFBREE7QUFFQUMsb0JBQUEsaUJBRkE7QUFHQUMscUJBQUE7QUFIQSxLQUFBO0FBTUEsQ0FUQTs7QUFXQXBDLElBQUFtQyxVQUFBLENBQUEsaUJBQUEsRUFBQSxVQUFBRSxNQUFBLEVBQUFDLGFBQUEsRUFBQTs7QUFFQTtBQUNBRCxXQUFBRSxNQUFBLEdBQUFDLEVBQUFDLE9BQUEsQ0FBQUgsYUFBQSxDQUFBO0FBRUEsQ0FMQTs7QUNWQXRDLElBQUFtQyxVQUFBLENBQUEsV0FBQSxFQUFBLFVBQUFFLE1BQUEsRUFBQUssYUFBQSxFQUFBQyxJQUFBLEVBQUFDLFdBQUEsRUFBQUMsUUFBQSxFQUFBQyxlQUFBLEVBQUFDLG1CQUFBLEVBQUE7O0FBRUFWLFdBQUFXLFFBQUEsR0FBQUosV0FBQTtBQUNBUCxXQUFBWSxLQUFBLEdBQUFKLFFBQUE7QUFDQVIsV0FBQWEsVUFBQSxHQUFBUixhQUFBOztBQUVBO0FBQ0FJLG9CQUFBSyxPQUFBLENBQUEsVUFBQUMsV0FBQSxFQUFBO0FBQ0FMLDRCQUFBTSxVQUFBLENBQUFELFlBQUFFLFdBQUEsRUFDQXpCLElBREEsQ0FDQSxVQUFBMEIsTUFBQSxFQUFBO0FBQ0FILHdCQUFBRyxNQUFBLEdBQUFBLE1BQUE7QUFDQSxTQUhBLEVBR0FDLEtBSEEsQ0FHQWIsS0FBQWMsS0FIQTtBQUlBLEtBTEE7O0FBT0E7QUFDQVgsb0JBQUFLLE9BQUEsQ0FBQSxVQUFBQyxXQUFBLEVBQUE7QUFDQUwsNEJBQUFXLFFBQUEsQ0FBQU4sWUFBQUUsV0FBQSxFQUNBekIsSUFEQSxDQUNBLFVBQUFDLElBQUEsRUFBQTtBQUNBc0Isd0JBQUF0QixJQUFBLEdBQUFBLElBQUE7QUFDQSxTQUhBLEVBR0EwQixLQUhBLENBR0FiLEtBQUFjLEtBSEE7QUFJQSxLQUxBO0FBTUFYLHNCQUFBQSxnQkFBQWEsSUFBQSxDQUFBLFVBQUFDLENBQUEsRUFBQUMsQ0FBQSxFQUFBO0FBQ0EsZUFBQUQsRUFBQU4sV0FBQSxHQUFBTyxFQUFBUCxXQUFBO0FBQ0EsS0FGQSxDQUFBO0FBR0FSLHNCQUFBTixFQUFBc0IsT0FBQSxDQUFBaEIsZUFBQSxFQUFBLGFBQUEsQ0FBQTtBQUNBVCxXQUFBMEIsTUFBQSxHQUFBQyxFQUFBQyxHQUFBLENBQUFuQixlQUFBLEVBQUEsVUFBQW9CLEtBQUEsRUFBQUMsQ0FBQSxFQUFBO0FBQ0EsWUFBQUEsQ0FBQSxFQUFBLE9BQUEsQ0FBQUQsS0FBQSxDQUFBO0FBQ0EsS0FGQSxDQUFBO0FBR0FFLFlBQUFDLEdBQUEsQ0FBQWhDLE9BQUEwQixNQUFBO0FBRUEsQ0E5QkE7O0FDREEvRCxJQUFBRyxNQUFBLENBQUEsVUFBQThCLGNBQUEsRUFBQTtBQUNBQSxtQkFDQWQsS0FEQSxDQUNBLE9BREEsRUFDQTtBQUNBZSxhQUFBLFFBREE7QUFFQUUscUJBQUEscUJBRkE7QUFHQUQsb0JBQUEsV0FIQTtBQUlBbUMsaUJBQUE7QUFDQTFCLHlCQUFBLHFCQUFBMkIsY0FBQSxFQUFBO0FBQ0EsdUJBQUFBLGVBQUFDLFFBQUEsRUFBQTtBQUNBLGFBSEE7QUFJQTNCLHNCQUFBLGtCQUFBNEIsV0FBQSxFQUFBO0FBQ0EsdUJBQUFBLFlBQUFELFFBQUEsRUFBQTtBQUNBLGFBTkE7QUFPQTFCLDZCQUFBLHlCQUFBQyxtQkFBQSxFQUFBO0FBQ0EsdUJBQUFBLG9CQUFBeUIsUUFBQSxFQUFBO0FBQ0EsYUFUQTtBQVVBOUIsMkJBQUEsdUJBQUFLLG1CQUFBLEVBQUE7QUFDQSx1QkFBQUEsb0JBQUEyQixrQkFBQSxFQUFBO0FBQ0E7QUFaQTtBQUpBLEtBREE7QUFvQkEsQ0FyQkE7O0FDQUExRSxJQUFBbUMsVUFBQSxDQUFBLFVBQUEsRUFBQSxVQUFBRSxNQUFBLEVBQUFNLElBQUEsRUFBQWdDLFdBQUEsRUFBQUMsV0FBQSxFQUFBO0FBQ0F2QyxXQUFBc0MsV0FBQSxHQUFBQSxXQUFBOztBQUVBdEMsV0FBQXdDLE1BQUEsR0FBQSxVQUFBQyxPQUFBLEVBQUE7QUFDQUYsb0JBQUFHLGNBQUEsQ0FBQUQsT0FBQSxFQUNBakQsSUFEQSxDQUNBLFVBQUFtRCxPQUFBLEVBQUE7QUFDQTNDLG1CQUFBc0MsV0FBQSxHQUFBSyxPQUFBO0FBQ0EsU0FIQSxFQUdBeEIsS0FIQSxDQUdBYixJQUhBO0FBSUEsS0FMQTs7QUFPQU4sV0FBQTRDLGNBQUEsR0FBQSxVQUFBQyxNQUFBLEVBQUFDLFFBQUEsRUFBQUMsYUFBQSxFQUFBO0FBQ0FSLG9CQUFBSyxjQUFBLENBQUFDLE1BQUEsRUFBQUMsUUFBQSxFQUFBQyxhQUFBO0FBQ0EvQyxlQUFBc0MsV0FBQSxHQUFBQyxZQUFBUyxVQUFBO0FBQ0EsS0FIQTs7QUFLQWhELFdBQUFpRCxRQUFBLEdBQUFWLFlBQUFVLFFBQUE7O0FBRUFqRCxXQUFBa0QsS0FBQSxHQUFBLFlBQUE7QUFDQSxZQUFBQSxRQUFBLENBQUE7QUFDQVosb0JBQUF4QixPQUFBLENBQUE7QUFBQSxtQkFBQW9DLFNBQUFDLEtBQUFDLEtBQUEsR0FBQUQsS0FBQUwsUUFBQTtBQUFBLFNBQUE7O0FBRUEsZUFBQUksS0FBQTtBQUNBLEtBTEE7QUFNQSxDQXZCQTs7QUNBQXZGLElBQUFHLE1BQUEsQ0FBQSxVQUFBOEIsY0FBQSxFQUFBO0FBQ0FBLG1CQUFBZCxLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0FlLGFBQUEsT0FEQTtBQUVBRSxxQkFBQSxtQkFGQTtBQUdBRCxvQkFBQSxVQUhBO0FBSUFtQyxpQkFBQTtBQUNBSyx5QkFBQSxxQkFBQUMsV0FBQSxFQUFBOztBQUVBLHVCQUFBQSxZQUFBYyxnQkFBQSxFQUFBO0FBRUE7QUFMQTtBQUpBLEtBQUE7QUFZQSxDQWJBOztBQ0FBMUYsSUFBQW1DLFVBQUEsQ0FBQSxjQUFBLEVBQUEsVUFBQUUsTUFBQSxFQUFBdUMsV0FBQSxFQUFBOztBQUVBQSxnQkFBQWMsZ0JBQUEsR0FDQTdELElBREEsQ0FDQSxVQUFBOEQsS0FBQSxFQUFBO0FBQ0F2QixnQkFBQUMsR0FBQSxDQUFBc0IsS0FBQTtBQUNBdEQsZUFBQXNELEtBQUEsR0FBQUEsS0FBQTs7QUFFQTtBQUNBLFlBQUFDLFdBQUFELEtBQUE7QUFDQSxZQUFBRSxpQkFBQSxFQUFBO0FBQ0FELGlCQUFBekMsT0FBQSxDQUFBLFVBQUEyQyxPQUFBLEVBQUE7QUFDQUQsMkJBQUFFLElBQUEsQ0FBQUQsUUFBQUwsS0FBQSxHQUFBSyxRQUFBWCxRQUFBO0FBQ0EsU0FGQTtBQUdBOUMsZUFBQWtELEtBQUEsR0FBQU0sZUFBQUcsTUFBQSxDQUFBLFVBQUFDLElBQUEsRUFBQUMsSUFBQTtBQUFBLG1CQUFBRCxPQUFBQyxJQUFBO0FBQUEsU0FBQSxDQUFBO0FBQ0EsS0FaQTs7QUFjQTdELFdBQUFpRCxRQUFBLEdBQUFWLFlBQUFVLFFBQUE7QUFFQSxDQWxCQTs7QUNBQXRGLElBQUFHLE1BQUEsQ0FBQSxVQUFBOEIsY0FBQSxFQUFBO0FBQ0FBLG1CQUFBZCxLQUFBLENBQUEsVUFBQSxFQUFBO0FBQ0FlLGFBQUEsV0FEQTtBQUVBRSxxQkFBQSwyQkFGQTtBQUdBRCxvQkFBQTtBQUhBLEtBQUE7QUFLQSxDQU5BOztBQ0FBLENBQUEsWUFBQTs7QUFFQTs7QUFFQTs7QUFDQSxRQUFBLENBQUFwQyxPQUFBRSxPQUFBLEVBQUEsTUFBQSxJQUFBa0csS0FBQSxDQUFBLHdCQUFBLENBQUE7O0FBRUEsUUFBQW5HLE1BQUFDLFFBQUFDLE1BQUEsQ0FBQSxhQUFBLEVBQUEsRUFBQSxDQUFBOztBQUVBRixRQUFBb0csT0FBQSxDQUFBLFFBQUEsRUFBQSxZQUFBO0FBQ0EsWUFBQSxDQUFBckcsT0FBQXNHLEVBQUEsRUFBQSxNQUFBLElBQUFGLEtBQUEsQ0FBQSxzQkFBQSxDQUFBO0FBQ0EsZUFBQXBHLE9BQUFzRyxFQUFBLENBQUF0RyxPQUFBWSxRQUFBLENBQUEyRixNQUFBLENBQUE7QUFDQSxLQUhBOztBQUtBO0FBQ0E7QUFDQTtBQUNBdEcsUUFBQXVHLFFBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQUMsc0JBQUEsb0JBREE7QUFFQUMscUJBQUEsbUJBRkE7QUFHQUMsdUJBQUEscUJBSEE7QUFJQUMsd0JBQUEsc0JBSkE7QUFLQUMsMEJBQUEsd0JBTEE7QUFNQUMsdUJBQUE7QUFOQSxLQUFBOztBQVNBN0csUUFBQW9HLE9BQUEsQ0FBQSxpQkFBQSxFQUFBLFVBQUFyRixVQUFBLEVBQUErRixFQUFBLEVBQUFDLFdBQUEsRUFBQTtBQUNBLFlBQUFDLGFBQUE7QUFDQSxpQkFBQUQsWUFBQUgsZ0JBREE7QUFFQSxpQkFBQUcsWUFBQUYsYUFGQTtBQUdBLGlCQUFBRSxZQUFBSixjQUhBO0FBSUEsaUJBQUFJLFlBQUFKO0FBSkEsU0FBQTtBQU1BLGVBQUE7QUFDQU0sMkJBQUEsdUJBQUFDLFFBQUEsRUFBQTtBQUNBbkcsMkJBQUFvRyxVQUFBLENBQUFILFdBQUFFLFNBQUEzRCxNQUFBLENBQUEsRUFBQTJELFFBQUE7QUFDQSx1QkFBQUosR0FBQU0sTUFBQSxDQUFBRixRQUFBLENBQUE7QUFDQTtBQUpBLFNBQUE7QUFNQSxLQWJBOztBQWVBbEgsUUFBQUcsTUFBQSxDQUFBLFVBQUFrSCxhQUFBLEVBQUE7QUFDQUEsc0JBQUFDLFlBQUEsQ0FBQXZCLElBQUEsQ0FBQSxDQUNBLFdBREEsRUFFQSxVQUFBd0IsU0FBQSxFQUFBO0FBQ0EsbUJBQUFBLFVBQUFDLEdBQUEsQ0FBQSxpQkFBQSxDQUFBO0FBQ0EsU0FKQSxDQUFBO0FBTUEsS0FQQTs7QUFTQXhILFFBQUF5SCxPQUFBLENBQUEsYUFBQSxFQUFBLFVBQUFDLEtBQUEsRUFBQUMsT0FBQSxFQUFBNUcsVUFBQSxFQUFBZ0csV0FBQSxFQUFBRCxFQUFBLEVBQUE7O0FBRUEsaUJBQUFjLGlCQUFBLENBQUFWLFFBQUEsRUFBQTtBQUNBLGdCQUFBOUYsT0FBQThGLFNBQUE5RixJQUFBO0FBQ0F1RyxvQkFBQUUsTUFBQSxDQUFBekcsS0FBQTBHLEVBQUEsRUFBQTFHLEtBQUFVLElBQUE7QUFDQWYsdUJBQUFvRyxVQUFBLENBQUFKLFlBQUFQLFlBQUE7QUFDQSxtQkFBQXBGLEtBQUFVLElBQUE7QUFDQTs7QUFFQSxhQUFBaUcsT0FBQSxHQUFBLFVBQUFqRyxJQUFBLEVBQUE7QUFDQSxtQkFBQUEsS0FBQWlHLE9BQUE7QUFDQSxTQUZBOztBQUlBO0FBQ0E7QUFDQSxhQUFBckcsZUFBQSxHQUFBLFlBQUE7QUFDQSxtQkFBQSxDQUFBLENBQUFpRyxRQUFBN0YsSUFBQTtBQUNBLFNBRkE7O0FBSUEsYUFBQUYsZUFBQSxHQUFBLFVBQUFvRyxVQUFBLEVBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxnQkFBQSxLQUFBdEcsZUFBQSxNQUFBc0csZUFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQWxCLEdBQUFwRyxJQUFBLENBQUFpSCxRQUFBN0YsSUFBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUJBQUE0RixNQUFBRixHQUFBLENBQUEsVUFBQSxFQUFBM0YsSUFBQSxDQUFBK0YsaUJBQUEsRUFBQXBFLEtBQUEsQ0FBQSxZQUFBO0FBQ0EsdUJBQUEsSUFBQTtBQUNBLGFBRkEsQ0FBQTtBQUlBLFNBckJBOztBQXVCQSxhQUFBeUUsS0FBQSxHQUFBLFVBQUFDLFdBQUEsRUFBQTtBQUNBLG1CQUFBUixNQUFBUyxJQUFBLENBQUEsUUFBQSxFQUFBRCxXQUFBLEVBQ0FyRyxJQURBLENBQ0ErRixpQkFEQSxFQUVBcEUsS0FGQSxDQUVBLFlBQUE7QUFDQSx1QkFBQXNELEdBQUFNLE1BQUEsQ0FBQSxFQUFBZ0IsU0FBQSw0QkFBQSxFQUFBLENBQUE7QUFDQSxhQUpBLENBQUE7QUFLQSxTQU5BOztBQVFBLGFBQUFDLE1BQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUFYLE1BQUFGLEdBQUEsQ0FBQSxTQUFBLEVBQUEzRixJQUFBLENBQUEsWUFBQTtBQUNBOEYsd0JBQUFXLE9BQUE7QUFDQXZILDJCQUFBb0csVUFBQSxDQUFBSixZQUFBTCxhQUFBO0FBQ0EsYUFIQSxDQUFBO0FBSUEsU0FMQTtBQU9BLEtBekRBOztBQTJEQTFHLFFBQUF5SCxPQUFBLENBQUEsU0FBQSxFQUFBLFVBQUExRyxVQUFBLEVBQUFnRyxXQUFBLEVBQUE7O0FBRUEsWUFBQXdCLE9BQUEsSUFBQTs7QUFFQXhILG1CQUFBTyxHQUFBLENBQUF5RixZQUFBSCxnQkFBQSxFQUFBLFlBQUE7QUFDQTJCLGlCQUFBRCxPQUFBO0FBQ0EsU0FGQTs7QUFJQXZILG1CQUFBTyxHQUFBLENBQUF5RixZQUFBSixjQUFBLEVBQUEsWUFBQTtBQUNBNEIsaUJBQUFELE9BQUE7QUFDQSxTQUZBOztBQUlBLGFBQUFSLEVBQUEsR0FBQSxJQUFBO0FBQ0EsYUFBQWhHLElBQUEsR0FBQSxJQUFBOztBQUVBLGFBQUErRixNQUFBLEdBQUEsVUFBQVcsU0FBQSxFQUFBMUcsSUFBQSxFQUFBO0FBQ0EsaUJBQUFnRyxFQUFBLEdBQUFVLFNBQUE7QUFDQSxpQkFBQTFHLElBQUEsR0FBQUEsSUFBQTtBQUNBLFNBSEE7O0FBS0EsYUFBQXdHLE9BQUEsR0FBQSxZQUFBO0FBQ0EsaUJBQUFSLEVBQUEsR0FBQSxJQUFBO0FBQ0EsaUJBQUFoRyxJQUFBLEdBQUEsSUFBQTtBQUNBLFNBSEE7QUFLQSxLQXpCQTtBQTJCQSxDQXhJQTs7QUNBQTlCLElBQUFtQyxVQUFBLENBQUEsb0JBQUEsRUFBQSxVQUFBUSxJQUFBLEVBQUFOLE1BQUEsRUFBQW9HLHFCQUFBLEVBQUE7O0FBRUFBLDBCQUFBakUsUUFBQSxHQUNBM0MsSUFEQSxDQUNBLFVBQUE2RyxhQUFBLEVBQUE7O0FBRUFBLHNCQUFBQyxTQUFBLENBQUF4RixPQUFBLENBQUEsVUFBQXlGLEdBQUEsRUFBQXpFLENBQUEsRUFBQTtBQUNBeUUsZ0JBQUFDLElBQUEsR0FBQSxJQUFBQyxJQUFBLENBQUFKLGNBQUFHLElBQUEsQ0FBQTFFLENBQUEsQ0FBQSxFQUFBNEUsUUFBQSxFQUFBO0FBQ0EsU0FGQTs7QUFJQTFHLGVBQUFhLFVBQUEsR0FBQXdGLGNBQUFDLFNBQUE7QUFDQSxLQVJBLEVBU0FuRixLQVRBLENBU0FiLElBVEE7QUFXQSxDQWJBOztBQ0FBM0MsSUFBQUcsTUFBQSxDQUFBLFVBQUE4QixjQUFBLEVBQUE7QUFDQUEsbUJBQUFkLEtBQUEsQ0FBQSxnQkFBQSxFQUFBO0FBQ0FlLGFBQUEsWUFEQTtBQUVBRSxxQkFBQSxnQ0FGQTtBQUdBRCxvQkFBQTtBQUhBLEtBQUE7QUFLQSxDQU5BOztBQ0FBbkMsSUFBQWdKLFNBQUEsQ0FBQSxXQUFBLEVBQUEsVUFBQS9ILE1BQUEsRUFBQTtBQUNBLFFBQUFnSSxxQkFBQSw4REFBQTtBQUNBLFFBQUFDLG1CQUFBLFNBQUFBLGdCQUFBLEdBQUE7QUFDQSxZQUFBQyxhQUFBO0FBQ0FDLGlCQUFBLENBQ0EsS0FEQSxFQUVBLGVBRkEsQ0FEQTtBQUtBQyxvQkFBQSxDQUNBLE9BREEsRUFFQSxTQUZBLEVBR0EsUUFIQTtBQUxBLFNBQUE7O0FBWUEsaUJBQUFDLElBQUEsR0FBQTtBQUNBLG1CQUFBLENBQUFDLEtBQUFDLE1BQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxFQUFBQyxPQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FBRUEsaUJBQUFDLElBQUEsQ0FBQUMsQ0FBQSxFQUFBO0FBQ0EsbUJBQUFKLEtBQUFLLEtBQUEsQ0FBQSxDQUFBLEtBQUFELENBQUEsSUFBQSxHQUFBLENBQUE7QUFDQTs7QUFFQSxpQkFBQUUsZ0JBQUEsQ0FBQUMsR0FBQSxFQUFBO0FBQ0EsbUJBQUFYLFdBQUFXLEdBQUEsRUFBQVAsS0FBQUssS0FBQSxDQUFBTCxLQUFBQyxNQUFBLEtBQUFMLFdBQUFXLEdBQUEsRUFBQUMsTUFBQSxDQUFBLENBQUE7QUFDQTs7QUFFQSxpQkFBQUMsYUFBQSxDQUFBRixHQUFBLEVBQUE7O0FBRUEsZ0JBQUFHLFNBQUFILFFBQUEsS0FBQSxHQUFBLENBQUEsR0FBQSxHQUFBO0FBQ0EsZ0JBQUFJLFFBQUEsOEJBQUEsQ0FBQVgsS0FBQUMsTUFBQSxLQUFBLEdBQUEsR0FBQVMsTUFBQSxFQUFBUixPQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsSUFBQTtBQUNBLGdCQUFBVSxZQUFBTixpQkFBQUMsR0FBQSxDQUFBO0FBQ0EsZ0JBQUFNLFNBQUFkLE1BQUE7QUFDQSxnQkFBQUssSUFBQSxhQUFBUyxNQUFBLEdBQUEsSUFBQTtBQUNBLGdCQUFBQyxJQUFBLGNBQUFYLEtBQUFVLE1BQUEsQ0FBQSxHQUFBLEdBQUE7QUFDQSxnQkFBQUUsUUFBQSxZQUFBSixLQUFBLEdBQUEsR0FBQSxHQUFBUCxDQUFBLEdBQUEsR0FBQSxHQUFBVSxDQUFBLEdBQUEsR0FBQTs7QUFFQSxtQkFBQSxLQUNBLFlBREEsR0FDQUYsU0FEQSxHQUNBLGtCQURBLEdBQ0FHLEtBREEsR0FDQSxHQURBLEdBRUEsV0FGQSxHQUVBSCxTQUZBLEdBRUEsU0FGQSxHQUVBLFNBRkEsR0FFQUQsS0FGQSxHQUVBLFFBRkEsR0FHQSxNQUhBO0FBSUE7O0FBRUEsWUFBQWQsTUFBQUcsS0FBQUssS0FBQSxDQUFBTCxLQUFBQyxNQUFBLEtBQUEsRUFBQSxJQUFBLEVBQUE7QUFDQSxZQUFBSCxTQUFBRSxLQUFBSyxLQUFBLENBQUFMLEtBQUFDLE1BQUEsS0FBQSxDQUFBLElBQUEsQ0FBQTs7QUFFQSxZQUFBZSxRQUFBLEVBQUE7O0FBRUEsYUFBQSxJQUFBcEcsSUFBQSxDQUFBLEVBQUFBLElBQUFpRixHQUFBLEVBQUFqRixHQUFBLEVBQUE7QUFDQW9HLHFCQUFBUCxjQUFBLEtBQUEsQ0FBQTtBQUNBOztBQUVBLGFBQUEsSUFBQVEsSUFBQSxDQUFBLEVBQUFBLElBQUFuQixNQUFBLEVBQUFtQixHQUFBLEVBQUE7QUFDQUQscUJBQUFQLGNBQUEsUUFBQSxDQUFBO0FBQ0E7O0FBRUFTLGlCQUFBQyxjQUFBLENBQUEsUUFBQSxFQUFBQyxTQUFBLEdBQUFKLEtBQUE7QUFDQSxLQXZEQTs7QUF5REEsV0FBQTtBQUNBSyxrQkFBQSxHQURBO0FBRUFDLGtCQUFBLG9DQUNBLG1DQURBLEdBRUEsK0JBRkEsR0FHQSx1Q0FIQSxHQUlBLE1BSkEsR0FLQSx5QkFMQSxHQU1BLFFBUkE7QUFTQUMsaUJBQUEsbUJBQUE7QUFDQSxtQkFBQTtBQUNBQyxxQkFBQSxlQUFBO0FBQ0EvRyxzQkFBQSxPQUFBLEVBQUFnSCxRQUFBLENBQUEsTUFBQTtBQUNBOUI7QUFDQSxpQkFKQTtBQUtBZixzQkFBQSxnQkFBQTs7QUFFQW5FLHNCQUFBLGdCQUFBLEVBQUFnSCxRQUFBLENBQUEsTUFBQTtBQUNBaEgsc0JBQUEsT0FBQSxFQUFBaUgsRUFBQSxDQUFBaEMsa0JBQUEsRUFBQSxVQUFBaUMsQ0FBQSxFQUFBO0FBQ0FqSywrQkFBQWMsRUFBQSxDQUFBLE9BQUE7QUFDQSxxQkFGQTtBQUdBO0FBWEEsYUFBQTtBQWFBLFNBdkJBO0FBd0JBb0osZUFBQSxpQkFBQSxDQUVBO0FBMUJBLEtBQUE7QUE0QkEsQ0F2RkE7O0FDQUFuTCxJQUFBRyxNQUFBLENBQUEsVUFBQThCLGNBQUEsRUFBQTtBQUNBQSxtQkFBQWQsS0FBQSxDQUFBLE1BQUEsRUFBQTtBQUNBZSxhQUFBLEdBREE7QUFFQUUscUJBQUE7QUFGQSxLQUFBO0FBSUEsQ0FMQTs7QUNBQXBDLElBQUFHLE1BQUEsQ0FBQSxVQUFBOEIsY0FBQSxFQUFBOztBQUVBQSxtQkFBQWQsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBZSxhQUFBLFFBREE7QUFFQUUscUJBQUEscUJBRkE7QUFHQUQsb0JBQUE7QUFIQSxLQUFBOztBQU1BRixtQkFBQWQsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBZSxhQUFBLFFBREE7QUFFQUUscUJBQUEscUJBRkE7QUFHQUQsb0JBQUE7QUFIQSxLQUFBOztBQU1BRixtQkFBQWQsS0FBQSxDQUFBLFVBQUEsRUFBQTtBQUNBZSxhQUFBLHdCQURBO0FBRUFFLHFCQUFBLDhCQUZBO0FBR0FELG9CQUFBO0FBSEEsS0FBQTtBQU1BLENBcEJBOztBQXNCQW5DLElBQUFtQyxVQUFBLENBQUEsV0FBQSxFQUFBLFVBQUFFLE1BQUEsRUFBQXJCLFdBQUEsRUFBQUMsTUFBQSxFQUFBbUssV0FBQSxFQUFBQyxZQUFBLEVBQUF6RyxXQUFBLEVBQUE7O0FBRUF2QyxXQUFBNEYsS0FBQSxHQUFBLEVBQUE7QUFDQTVGLFdBQUFvQixLQUFBLEdBQUEsSUFBQTtBQUNBcEIsV0FBQWlKLEtBQUEsR0FBQUQsYUFBQUMsS0FBQTs7QUFFQWpKLFdBQUFrSixjQUFBLEdBQUEsVUFBQUMsS0FBQSxFQUFBO0FBQ0FKLG9CQUFBRyxjQUFBLENBQUFDLEtBQUEsRUFBQTNKLElBQUEsQ0FBQSxZQUFBO0FBQ0E0Six3QkFBQUMsS0FBQSxDQUFBLGtCQUFBLEVBQUEsSUFBQTtBQUNBLFNBRkE7QUFHQSxLQUpBO0FBS0FySixXQUFBc0osYUFBQSxHQUFBLFVBQUFMLEtBQUEsRUFBQU0sUUFBQSxFQUFBO0FBQ0FSLG9CQUFBTyxhQUFBLENBQUFDLFFBQUEsRUFBQS9KLElBQUEsQ0FBQSxZQUFBO0FBQ0FaLG1CQUFBYyxFQUFBLENBQUEsT0FBQTtBQUNBLFNBRkE7QUFHQSxLQUpBOztBQU1BTSxXQUFBd0osU0FBQSxHQUFBLFVBQUFDLFNBQUEsRUFBQTs7QUFFQXpKLGVBQUFvQixLQUFBLEdBQUEsSUFBQTs7QUFFQXpDLG9CQUFBaUgsS0FBQSxDQUFBNkQsU0FBQSxFQUFBakssSUFBQSxDQUFBLFlBQUE7QUFDQSxtQkFBQStDLFlBQUFjLGdCQUFBLEVBQUE7QUFDQSxTQUZBLEVBRUE3RCxJQUZBLENBRUEsVUFBQTJELElBQUEsRUFBQTtBQUNBdkUsbUJBQUFjLEVBQUEsQ0FBQSxPQUFBO0FBQ0EsU0FKQSxFQUlBeUIsS0FKQSxDQUlBLFlBQUE7QUFDQW5CLG1CQUFBb0IsS0FBQSxHQUFBLDRCQUFBO0FBQ0EsU0FOQTtBQVFBLEtBWkE7QUFjQSxDQS9CQTs7QUN0QkF6RCxJQUFBRyxNQUFBLENBQUEsVUFBQThCLGNBQUEsRUFBQTs7QUFFQUEsbUJBQUFkLEtBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQWUsYUFBQSxlQURBO0FBRUEySSxrQkFBQSxtRUFGQTtBQUdBMUksb0JBQUEsb0JBQUFFLE1BQUEsRUFBQTBKLFdBQUEsRUFBQTtBQUNBQSx3QkFBQUMsUUFBQSxHQUFBbkssSUFBQSxDQUFBLFVBQUFvSyxLQUFBLEVBQUE7QUFDQTVKLHVCQUFBNEosS0FBQSxHQUFBQSxLQUFBO0FBQ0EsYUFGQTtBQUdBLFNBUEE7QUFRQTtBQUNBO0FBQ0E3SyxjQUFBO0FBQ0FDLDBCQUFBO0FBREE7QUFWQSxLQUFBO0FBZUEsQ0FqQkE7O0FBbUJBckIsSUFBQW9HLE9BQUEsQ0FBQSxhQUFBLEVBQUEsVUFBQXNCLEtBQUEsRUFBQTs7QUFFQSxRQUFBc0UsV0FBQSxTQUFBQSxRQUFBLEdBQUE7QUFDQSxlQUFBdEUsTUFBQUYsR0FBQSxDQUFBLDJCQUFBLEVBQUEzRixJQUFBLENBQUEsVUFBQXFGLFFBQUEsRUFBQTtBQUNBLG1CQUFBQSxTQUFBOUYsSUFBQTtBQUNBLFNBRkEsQ0FBQTtBQUdBLEtBSkE7O0FBTUEsV0FBQTtBQUNBNEssa0JBQUFBO0FBREEsS0FBQTtBQUlBLENBWkE7QUNuQkFoTSxJQUFBbUMsVUFBQSxDQUFBLGFBQUEsRUFBQSxVQUFBRSxNQUFBLEVBQUFvQyxXQUFBLEVBQUE5QixJQUFBLEVBQUFpQyxXQUFBLEVBQUFzSCxTQUFBLEVBQUFDLFlBQUEsRUFBQTtBQUNBOUosV0FBQStKLElBQUEsR0FBQSxFQUFBOztBQUVBL0osV0FBQWdLLFlBQUEsR0FBQSxZQUFBOztBQUVBNUgsb0JBQUE2SCx1QkFBQSxDQUFBakssT0FBQStKLElBQUEsRUFDQXZLLElBREEsQ0FDQSxZQUFBO0FBQ0FRLG1CQUFBa0ssTUFBQSxHQUFBLElBQUE7QUFDQSxTQUhBLEVBR0EvSSxLQUhBLENBR0FiLEtBQUFjLEtBSEE7QUFLQSxLQVBBO0FBUUFwQixXQUFBNkosU0FBQSxHQUFBQSxTQUFBO0FBQ0E3SixXQUFBOEosWUFBQSxHQUFBQSxZQUFBO0FBQ0E5SixXQUFBbUssYUFBQSxHQUFBTCxhQUFBbEksR0FBQSxDQUFBO0FBQUEsZUFBQXdJLEtBQUFDLEtBQUE7QUFBQSxLQUFBLEVBQUFDLElBQUEsQ0FBQSxHQUFBLENBQUE7QUFDQSxDQWRBO0FDQUEzTSxJQUFBRyxNQUFBLENBQUEsVUFBQThCLGNBQUEsRUFBQTtBQUNBQSxtQkFBQWQsS0FBQSxDQUFBLFNBQUEsRUFBQTtBQUNBZSxhQUFBLFVBREE7QUFFQUUscUJBQUEseUJBRkE7QUFHQUQsb0JBQUEsYUFIQTtBQUlBbUMsaUJBQUE7QUFDQTRILHVCQUFBLG1CQUFBdEgsV0FBQSxFQUFBO0FBQUEsdUJBQUFBLFlBQUFnSSxZQUFBLEVBQUE7QUFBQSxhQURBO0FBRUFULDBCQUFBLHNCQUFBdkgsV0FBQSxFQUFBO0FBQUEsdUJBQUFBLFlBQUFjLGdCQUFBLEVBQUE7QUFBQTtBQUZBO0FBSkEsS0FBQTtBQVNBLENBVkE7O0FDQUExRixJQUFBbUMsVUFBQSxDQUFBLGFBQUEsRUFBQSxVQUFBRSxNQUFBLEVBQUF3SyxVQUFBLEVBQUFDLFVBQUEsRUFBQXZJLGNBQUEsRUFBQUssV0FBQSxFQUFBO0FBQ0E7QUFDQXZDLFdBQUEwSyxTQUFBLEdBQUEsRUFBQTtBQUNBMUssV0FBQTJLLE9BQUEsR0FBQUgsVUFBQTtBQUNBeEssV0FBQTRLLE9BQUEsR0FBQUgsVUFBQTtBQUNBO0FBQ0F6SyxXQUFBNkssU0FBQSxHQUFBLEtBQUE7QUFDQTdLLFdBQUE4SyxZQUFBLEdBQUEsWUFBQTtBQUNBOUssZUFBQTBLLFNBQUEsQ0FBQUssU0FBQSxHQUFBL0ssT0FBQTJLLE9BQUEsQ0FBQWxGLEVBQUE7QUFDQXZELHVCQUFBOEksWUFBQSxDQUFBaEwsT0FBQTJLLE9BQUEsQ0FBQWxGLEVBQUEsRUFBQXpGLE9BQUEwSyxTQUFBLEVBQUFsTCxJQUFBLENBQUEsWUFBQTtBQUNBUSxtQkFBQTRLLE9BQUEsR0FBQTFJLGVBQUErSSxhQUFBO0FBQ0FqTCxtQkFBQTBLLFNBQUEsR0FBQSxFQUFBO0FBQ0F0Qix3QkFBQUMsS0FBQSxDQUFBLFlBQUEsRUFBQSxJQUFBO0FBQ0EsU0FKQSxFQUlBbEksS0FKQSxDQUlBLFlBQUE7QUFDQWlJLHdCQUFBQyxLQUFBLENBQUEsc0JBQUEsRUFBQSxJQUFBO0FBQ0EsU0FOQTtBQU9BLEtBVEE7QUFVQTtBQUNBckosV0FBQWtMLFNBQUEsR0FBQSxZQUFBO0FBQ0EzSSxvQkFBQTJJLFNBQUEsQ0FBQWxMLE9BQUEySyxPQUFBLENBQUFsRixFQUFBLEVBQUF6RixPQUFBOEMsUUFBQTtBQUNBLEtBRkE7QUFHQTlDLFdBQUFtTCxVQUFBLEdBQUEsVUFBQUMsR0FBQSxFQUFBO0FBQ0EsWUFBQTdFLE1BQUEsRUFBQTtBQUNBLGFBQUEsSUFBQXpFLElBQUEsQ0FBQSxFQUFBQSxLQUFBc0osR0FBQSxFQUFBdEosR0FBQSxFQUFBO0FBQ0F5RSxnQkFBQTdDLElBQUEsQ0FBQTVCLENBQUE7QUFDQTtBQUNBLGVBQUF5RSxHQUFBO0FBQ0EsS0FOQTtBQU9BLENBNUJBOztBQ0FBNUksSUFBQUcsTUFBQSxDQUFBLFVBQUE4QixjQUFBLEVBQUE7QUFDQUEsbUJBQUFkLEtBQUEsQ0FBQSxTQUFBLEVBQUE7QUFDQXVNLG9CQUFBLE1BREE7QUFFQXhMLGFBQUEsc0JBRkE7QUFHQUUscUJBQUEseUJBSEE7QUFJQUQsb0JBQUEsYUFKQTtBQUtBbUMsaUJBQUE7QUFDQXVJLHdCQUFBLG9CQUFBdEksY0FBQSxFQUFBOEcsWUFBQSxFQUFBO0FBQ0EsdUJBQUE5RyxlQUFBb0osU0FBQSxDQUFBdEMsYUFBQStCLFNBQUEsQ0FBQTtBQUNBLGFBSEE7QUFJQU4sd0JBQUEsb0JBQUF2SSxjQUFBLEVBQUE4RyxZQUFBLEVBQUE7QUFDQSx1QkFBQTlHLGVBQUFxSixlQUFBLENBQUF2QyxhQUFBK0IsU0FBQSxDQUFBO0FBQ0E7QUFOQTtBQUxBLEtBQUE7QUFjQSxDQWZBOztBQ0FBcE4sSUFBQUcsTUFBQSxDQUFBLFVBQUE4QixjQUFBLEVBQUE7O0FBRUFBLG1CQUFBZCxLQUFBLENBQUEsUUFBQSxFQUFBO0FBQ0FlLGFBQUEsU0FEQTtBQUVBRSxxQkFBQSx1QkFGQTtBQUdBRCxvQkFBQTtBQUhBLEtBQUE7QUFNQSxDQVJBOztBQVVBbkMsSUFBQW1DLFVBQUEsQ0FBQSxZQUFBLEVBQUEsVUFBQUUsTUFBQSxFQUFBK0ksV0FBQSxFQUFBbkssTUFBQSxFQUFBO0FBQ0FvQixXQUFBd0wsTUFBQSxHQUFBLEVBQUE7QUFDQXhMLFdBQUF5TCxVQUFBLEdBQUEsVUFBQUMsVUFBQSxFQUFBO0FBQ0EzQyxvQkFBQXlDLE1BQUEsQ0FBQUUsVUFBQSxFQUNBbE0sSUFEQSxDQUNBLFVBQUFxRixRQUFBLEVBQUE7QUFDQSxnQkFBQUEsYUFBQSxzQkFBQSxFQUFBO0FBQ0F1RSw0QkFBQUMsS0FBQSxDQUFBLHFCQUFBLEVBQUEsSUFBQTtBQUNBLGFBRkEsTUFFQTtBQUNBekssdUJBQUFjLEVBQUEsQ0FBQSxPQUFBO0FBQ0E7QUFDQSxTQVBBO0FBUUEsS0FUQTtBQVVBTSxXQUFBMkwsWUFBQSxHQUFBNUMsWUFBQTRDLFlBQUE7QUFDQSxDQWJBOztBQ1ZBaE8sSUFBQW1DLFVBQUEsQ0FBQSxXQUFBLEVBQUEsVUFBQUUsTUFBQSxFQUFBVyxRQUFBLEVBQUE7QUFDQVgsV0FBQVcsUUFBQSxHQUFBQSxRQUFBO0FBQ0EsQ0FGQTs7QUNBQWhELElBQUFHLE1BQUEsQ0FBQSxVQUFBOEIsY0FBQSxFQUFBO0FBQ0FBLG1CQUFBZCxLQUFBLENBQUEsT0FBQSxFQUFBO0FBQ0FlLGFBQUEsUUFEQTtBQUVBRSxxQkFBQSxxQkFGQTtBQUdBRCxvQkFBQSxXQUhBO0FBSUFtQyxpQkFBQTtBQUNBdEIsc0JBQUEsa0JBQUF1QixjQUFBLEVBQUE7QUFDQSx1QkFBQUEsZUFBQUMsUUFBQSxFQUFBO0FBQ0E7QUFIQTtBQUpBLEtBQUE7QUFVQSxDQVhBOztBQ0FBeEUsSUFBQW9HLE9BQUEsQ0FBQSxlQUFBLEVBQUEsWUFBQTtBQUNBLFdBQUEsQ0FDQSx1REFEQSxFQUVBLHFIQUZBLEVBR0EsaURBSEEsRUFJQSxpREFKQSxFQUtBLHVEQUxBLEVBTUEsdURBTkEsRUFPQSx1REFQQSxFQVFBLHVEQVJBLEVBU0EsdURBVEEsRUFVQSx1REFWQSxFQVdBLHVEQVhBLEVBWUEsdURBWkEsRUFhQSx1REFiQSxFQWNBLHVEQWRBLEVBZUEsdURBZkEsRUFnQkEsdURBaEJBLEVBaUJBLHVEQWpCQSxFQWtCQSx1REFsQkEsRUFtQkEsdURBbkJBLEVBb0JBLHVEQXBCQSxFQXFCQSx1REFyQkEsRUFzQkEsdURBdEJBLEVBdUJBLHVEQXZCQSxFQXdCQSx1REF4QkEsRUF5QkEsdURBekJBLEVBMEJBLHVEQTFCQSxDQUFBO0FBNEJBLENBN0JBOztBQ0FBcEcsSUFBQW9HLE9BQUEsQ0FBQSx1QkFBQSxFQUFBLFVBQUFzQixLQUFBLEVBQUE7O0FBRUEsUUFBQXJDLGFBQUEsRUFBQTtBQUNBLFFBQUE0SSxVQUFBLG1CQUFBO0FBQ0EsUUFBQUMsd0JBQUEsRUFBQTtBQUNBLFFBQUFDLFVBQUEsU0FBQUEsT0FBQTtBQUFBLGVBQUFDLElBQUFoTixJQUFBO0FBQUEsS0FBQTs7QUFFQThNLDBCQUFBMUosUUFBQSxHQUFBLFlBQUE7QUFDQSxlQUFBa0QsTUFBQUYsR0FBQSxDQUFBeUcsT0FBQSxFQUNBcE0sSUFEQSxDQUNBLFVBQUFxRixRQUFBLEVBQUE7QUFDQWpILG9CQUFBb08sSUFBQSxDQUFBbkgsU0FBQTlGLElBQUEsRUFBQWlFLFVBQUE7QUFDQSxtQkFBQUEsVUFBQTtBQUNBLFNBSkEsQ0FBQTtBQUtBLEtBTkE7O0FBVUEsV0FBQTZJLHFCQUFBO0FBRUEsQ0FuQkE7O0FDQUFsTyxJQUFBb0csT0FBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTs7QUFFQSxRQUFBa0kscUJBQUEsU0FBQUEsa0JBQUEsQ0FBQTFGLEdBQUEsRUFBQTtBQUNBLGVBQUFBLElBQUFXLEtBQUFLLEtBQUEsQ0FBQUwsS0FBQUMsTUFBQSxLQUFBWixJQUFBbUIsTUFBQSxDQUFBLENBQUE7QUFDQSxLQUZBOztBQUlBLFFBQUF3RSxZQUFBLENBQ0EsZUFEQSxFQUVBLHVCQUZBLEVBR0Esc0JBSEEsRUFJQSx1QkFKQSxFQUtBLHlEQUxBLEVBTUEsMENBTkEsRUFPQSxjQVBBLEVBUUEsdUJBUkEsRUFTQSxJQVRBLEVBVUEsaUNBVkEsRUFXQSwwREFYQSxFQVlBLDZFQVpBLENBQUE7O0FBZUEsV0FBQTtBQUNBQSxtQkFBQUEsU0FEQTtBQUVBQywyQkFBQSw2QkFBQTtBQUNBLG1CQUFBRixtQkFBQUMsU0FBQSxDQUFBO0FBQ0E7QUFKQSxLQUFBO0FBT0EsQ0E1QkE7O0FDQUF2TyxJQUFBb0csT0FBQSxDQUFBLGFBQUEsRUFBQSxVQUFBc0IsS0FBQSxFQUFBOztBQUVBLFFBQUF5RyxVQUFBLFNBQUFBLE9BQUE7QUFBQSxlQUFBQyxJQUFBaE4sSUFBQTtBQUFBLEtBQUE7O0FBRUEsUUFBQWdLLGNBQUEsRUFBQTs7QUFHQUEsZ0JBQUF5QyxNQUFBLEdBQUEsVUFBQUUsVUFBQSxFQUFBO0FBQ0EsZUFBQXJHLE1BQUFTLElBQUEsQ0FBQSxTQUFBLEVBQUE0RixVQUFBLEVBQUFsTSxJQUFBLENBQUFzTSxPQUFBLENBQUE7QUFDQSxLQUZBOztBQUlBL0MsZ0JBQUE0QyxZQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUF0RyxNQUFBRixHQUFBLENBQUEsY0FBQSxDQUFBO0FBQ0EsS0FGQTs7QUFJQTRELGdCQUFBTyxhQUFBLEdBQUEsVUFBQUwsS0FBQSxFQUFBckQsS0FBQSxFQUFBO0FBQ0EsZUFBQVAsTUFBQVMsSUFBQSxDQUFBLHFCQUFBbUQsS0FBQSxFQUFBckQsS0FBQSxDQUFBO0FBQ0EsS0FGQTs7QUFJQW1ELGdCQUFBRyxjQUFBLEdBQUEsVUFBQUMsS0FBQSxFQUFBO0FBQ0EsZUFBQTlELE1BQUFTLElBQUEsQ0FBQSxTQUFBLEVBQUFxRCxLQUFBLENBQUE7QUFDQSxLQUZBOztBQUlBLFdBQUFKLFdBQUE7QUFDQSxDQXhCQTs7QUNBQXBMLElBQUFvRyxPQUFBLENBQUEsYUFBQSxFQUFBLFVBQUFzQixLQUFBLEVBQUEvRSxJQUFBLEVBQUExQixNQUFBLEVBQUFGLFVBQUEsRUFBQTs7QUFFQSxRQUFBb04sVUFBQSxTQUFBQSxPQUFBO0FBQUEsZUFBQUMsSUFBQWhOLElBQUE7QUFBQSxLQUFBO0FBQ0EsUUFBQTZNLFVBQUEsbUJBQUE7QUFDQSxRQUFBUSxVQUFBLFNBQUFBLE9BQUEsQ0FBQWhDLElBQUEsRUFBQTtBQUNBQSxhQUFBaUMsUUFBQSxHQUFBLG1CQUFBakMsS0FBQVcsU0FBQSxHQUFBLFFBQUE7QUFDQSxlQUFBWCxJQUFBO0FBQ0EsS0FIQTtBQUlBLFFBQUE3SCxjQUFBLEVBQUE7QUFDQUEsZ0JBQUFTLFVBQUEsR0FBQSxFQUFBOztBQUVBVCxnQkFBQWMsZ0JBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQWdDLE1BQUFGLEdBQUEsQ0FBQXlHLE9BQUEsRUFDQXBNLElBREEsQ0FDQSxVQUFBcUYsUUFBQSxFQUFBO0FBQ0FqSCxvQkFBQW9PLElBQUEsQ0FBQW5ILFNBQUE5RixJQUFBLEVBQUF3RCxZQUFBUyxVQUFBO0FBQ0EsbUJBQUFULFlBQUFTLFVBQUEsQ0FBQTFCLElBQUEsQ0FBQSxVQUFBQyxDQUFBLEVBQUFDLENBQUEsRUFBQTtBQUNBLHVCQUFBQSxFQUFBaUUsRUFBQSxHQUFBbEUsRUFBQWtFLEVBQUE7QUFDQSxhQUZBLENBQUE7QUFHQSxTQU5BLEVBT0FqRyxJQVBBLENBT0EsVUFBQThELEtBQUEsRUFBQTtBQUNBZix3QkFBQVMsVUFBQSxHQUFBTSxNQUFBMUIsR0FBQSxDQUFBd0ssT0FBQSxDQUFBO0FBQ0ExTix1QkFBQTROLEtBQUEsQ0FBQSxZQUFBLEVBQUEvSixZQUFBUyxVQUFBO0FBQ0EsbUJBQUFNLE1BQUExQixHQUFBLENBQUF3SyxPQUFBLENBQUE7QUFDQSxTQVhBLENBQUE7QUFZQSxLQWJBOztBQWVBN0osZ0JBQUFnSyxVQUFBLEdBQUEsVUFBQXhCLFNBQUEsRUFBQTtBQUNBLGVBQUExRixNQUFBbUgsTUFBQSxDQUFBWixVQUFBYixTQUFBLEVBQ0F2TCxJQURBLENBQ0EsVUFBQXFGLFFBQUEsRUFBQTtBQUNBakgsb0JBQUFvTyxJQUFBLENBQUFuSCxTQUFBOUYsSUFBQSxFQUFBd0QsWUFBQVMsVUFBQTtBQUNBLG1CQUFBVCxZQUFBUyxVQUFBO0FBQ0EsU0FKQSxDQUFBO0FBS0EsS0FOQTs7QUFRQVQsZ0JBQUFrSyxrQkFBQSxHQUFBLFVBQUExQixTQUFBLEVBQUE7QUFDQSxZQUFBMkIsWUFBQSxLQUFBMUosVUFBQSxDQUFBMkosTUFBQSxDQUFBO0FBQUEsbUJBQUF2QyxLQUFBVyxTQUFBLEtBQUFBLFNBQUE7QUFBQSxTQUFBLENBQUE7QUFDQSxlQUFBMkIsVUFBQWhGLE1BQUEsR0FBQWdGLFVBQUEsQ0FBQSxDQUFBLEdBQUEsSUFBQTtBQUNBLEtBSEE7O0FBS0FuSyxnQkFBQTJJLFNBQUEsR0FBQSxVQUFBSCxTQUFBLEVBQUFqSSxRQUFBLEVBQUE7QUFDQSxZQUFBNEosWUFBQW5LLFlBQUFrSyxrQkFBQSxDQUFBMUIsU0FBQSxDQUFBO0FBQ0EsWUFBQTJCLFNBQUEsRUFBQTtBQUNBLG1CQUFBbkssWUFDQUssY0FEQSxDQUNBOEosVUFBQWpILEVBREEsRUFDQWlILFVBQUE1SixRQURBLEVBQ0EsS0FEQSxFQUNBQSxRQURBLENBQUE7QUFFQSxTQUhBLE1BR0E7QUFDQThKO0FBQ0EsbUJBQUF2SCxNQUFBUyxJQUFBLENBQUE4RixVQUFBYixTQUFBLEVBQUEsRUFBQWpJLFVBQUFBLFFBQUEsRUFBQSxFQUNBdEQsSUFEQSxDQUNBLFVBQUFxRixRQUFBLEVBQUE7QUFDQSxvQkFBQXVGLE9BQUF2RixTQUFBOUYsSUFBQTtBQUNBd0QsNEJBQUFTLFVBQUEsQ0FBQVUsSUFBQSxDQUFBMEcsSUFBQTtBQUNBLHVCQUFBQSxJQUFBO0FBQ0EsYUFMQSxDQUFBO0FBTUE7QUFDQTtBQUNBLEtBZkE7O0FBaUJBN0gsZ0JBQUFHLGNBQUEsR0FBQSxVQUFBRCxPQUFBLEVBQUE7QUFDQW9LO0FBQ0EsZUFBQXhILE1BQUFtSCxNQUFBLENBQUFaLFVBQUFuSixPQUFBLEVBQ0FxSyxPQURBLENBQ0EsWUFBQTtBQUNBdkssd0JBQUF3Syx1QkFBQSxDQUFBdEssT0FBQTtBQUNBLFNBSEEsRUFJQWpELElBSkEsQ0FJQSxZQUFBO0FBQ0EsbUJBQUErQyxZQUFBUyxVQUFBO0FBQ0EsU0FOQSxDQUFBO0FBT0EsS0FUQTtBQVVBVCxnQkFBQUssY0FBQSxHQUFBLFVBQUFILE9BQUEsRUFBQUssUUFBQSxFQUFBa0ssVUFBQSxFQUFBO0FBQUEsWUFBQUMsTUFBQSx5REFBQSxDQUFBOztBQUNBLFlBQUFDLFVBQUEsS0FBQTtBQUNBLFlBQUFGLGVBQUEsS0FBQSxFQUFBO0FBQ0FKO0FBQ0E5Six3QkFBQSxDQUFBbUssTUFBQTtBQUNBQyxzQkFBQSxJQUFBO0FBQ0EsU0FKQSxNQUtBLElBQUFGLGVBQUEsVUFBQSxJQUFBbEssV0FBQSxDQUFBLEVBQUE7QUFDQStKO0FBQ0EvSix3QkFBQSxDQUFBbUssTUFBQTtBQUNBQyxzQkFBQSxJQUFBO0FBQ0E7QUFDQSxZQUFBQSxZQUFBLElBQUEsRUFBQTtBQUNBLG1CQUFBN0gsTUFBQThILEdBQUEsQ0FBQXZCLFVBQUFuSixPQUFBLEVBQUEsRUFBQUssVUFBQUEsUUFBQSxFQUFBO0FBQ0E7QUFEQSxhQUVBdEQsSUFGQSxDQUVBLFlBQUE7QUFDQStDLDRCQUFBNkssMkJBQUEsQ0FBQTNLLE9BQUEsRUFBQUssUUFBQTtBQUNBLGFBSkEsQ0FBQTtBQUtBO0FBR0EsS0FyQkE7O0FBdUJBUCxnQkFBQXdLLHVCQUFBLEdBQUEsVUFBQXRLLE9BQUEsRUFBQTtBQUNBLFlBQUE0SyxLQUFBO0FBQ0E5SyxvQkFBQVMsVUFBQSxDQUFBbEMsT0FBQSxDQUFBLFVBQUFlLEtBQUEsRUFBQUMsQ0FBQSxFQUFBO0FBQ0EsZ0JBQUFELE1BQUE0RCxFQUFBLEtBQUFoRCxPQUFBLEVBQUE0SyxRQUFBdkwsQ0FBQTtBQUNBLFNBRkE7O0FBSUFTLG9CQUFBUyxVQUFBLENBQUFzSyxNQUFBLENBQUFELEtBQUEsRUFBQSxDQUFBO0FBQ0EsS0FQQTs7QUFTQTlLLGdCQUFBNkssMkJBQUEsR0FBQSxVQUFBM0ssT0FBQSxFQUFBSyxRQUFBLEVBQUE7QUFDQSxZQUFBaEIsSUFBQVMsWUFBQVMsVUFBQSxDQUFBdUssU0FBQSxDQUFBLFVBQUExTCxLQUFBLEVBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBQUEsTUFBQTRELEVBQUEsS0FBQWhELE9BQUE7QUFDQSxTQUxBLENBQUE7QUFNQUYsb0JBQUFTLFVBQUEsQ0FBQWxCLENBQUEsRUFBQWdCLFFBQUEsR0FBQUEsUUFBQTtBQUNBLEtBUkE7O0FBVUFQLGdCQUFBVSxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUFvQyxNQUFBRixHQUFBLENBQUF5RyxVQUFBLFVBQUEsRUFDQXBNLElBREEsQ0FDQSxZQUFBO0FBQ0FaLG1CQUFBYyxFQUFBLENBQUEsZ0JBQUE7QUFDQTZDLHdCQUFBUyxVQUFBLENBQUFzSyxNQUFBLENBQUEsQ0FBQSxFQUFBL0ssWUFBQVMsVUFBQSxDQUFBMEUsTUFBQTtBQUNBLFNBSkEsRUFLQXZHLEtBTEEsQ0FLQSxZQUFBO0FBQ0FpSSx3QkFBQUMsS0FBQSxDQUFBLDRCQUFBLEVBQUEsSUFBQTtBQUNBLFNBUEEsQ0FBQTtBQVFBLEtBVEE7O0FBV0E5RyxnQkFBQWdJLFlBQUEsR0FBQSxZQUFBO0FBQ0EsWUFBQXJILFFBQUEsQ0FBQTtBQUNBLGVBQUFYLFlBQUFjLGdCQUFBLEdBQ0E3RCxJQURBLENBQ0EsVUFBQTJELElBQUEsRUFBQTtBQUNBcEIsb0JBQUFDLEdBQUEsQ0FBQW1CLElBQUE7QUFDQUEsaUJBQUFyQyxPQUFBLENBQUE7QUFBQSx1QkFBQW9DLFNBQUFrSCxLQUFBaEgsS0FBQSxHQUFBZ0gsS0FBQXRILFFBQUE7QUFBQSxhQUFBO0FBQ0FmLG9CQUFBQyxHQUFBLENBQUEsTUFBQSxFQUFBa0IsS0FBQTtBQUNBLG1CQUFBQSxLQUFBO0FBQ0EsU0FOQSxFQU9BL0IsS0FQQSxDQU9BYixLQUFBYyxLQVBBLENBQUE7QUFRQSxLQVZBOztBQWFBLFFBQUFvTSxlQUFBLDhFQUFBOztBQUVBLGFBQUFaLG1CQUFBLEdBQUE7QUFDQWpMLFVBQUEsWUFBQSxFQUFBZ0gsUUFBQSxDQUFBLHFCQUFBLEVBQUE4RSxHQUFBLENBQUFELFlBQUEsRUFBQSxZQUFBO0FBQ0E3TCxjQUFBLFlBQUEsRUFBQStMLFdBQUEsQ0FBQSxxQkFBQTtBQUNBLFNBRkE7QUFHQTs7QUFFQSxhQUFBYixrQkFBQSxHQUFBO0FBQ0FsTCxVQUFBLFlBQUEsRUFBQWdILFFBQUEsQ0FBQSxnQkFBQSxFQUFBOEUsR0FBQSxDQUFBRCxZQUFBLEVBQUEsWUFBQTtBQUNBN0wsY0FBQSxZQUFBLEVBQUErTCxXQUFBLENBQUEsZ0JBQUE7QUFDQSxTQUZBO0FBR0E7O0FBRUEsV0FBQW5MLFdBQUE7QUFFQSxDQXBKQTs7QUNBQTVFLElBQUFvRyxPQUFBLENBQUEscUJBQUEsRUFBQSxVQUFBc0IsS0FBQSxFQUFBOztBQUVBLFFBQUFzSSxxQkFBQSxFQUFBO0FBQ0EsUUFBQUMsbUJBQUEsRUFBQTtBQUNBLFFBQUFoQyxVQUFBLG9CQUFBO0FBQ0EsUUFBQWlDLHNCQUFBLEVBQUE7QUFDQSxRQUFBL0IsVUFBQSxTQUFBQSxPQUFBO0FBQUEsZUFBQUMsSUFBQWhOLElBQUE7QUFBQSxLQUFBOztBQUVBOE8sd0JBQUExTCxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUFrRCxNQUFBRixHQUFBLENBQUF5RyxPQUFBLEVBQ0FwTSxJQURBLENBQ0EsVUFBQXFGLFFBQUEsRUFBQTtBQUNBakgsb0JBQUFvTyxJQUFBLENBQUFuSCxTQUFBOUYsSUFBQSxFQUFBNE8sa0JBQUE7QUFDQSxtQkFBQUEsa0JBQUE7QUFDQSxTQUpBLENBQUE7QUFLQSxLQU5BOztBQVFBRSx3QkFBQXhMLGtCQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUFnRCxNQUFBRixHQUFBLENBQUF5RyxVQUFBLFdBQUEsRUFDQXBNLElBREEsQ0FDQSxVQUFBcUYsUUFBQSxFQUFBO0FBQ0FqSCxvQkFBQW9PLElBQUEsQ0FBQW5ILFNBQUE5RixJQUFBLEVBQUE2TyxnQkFBQTtBQUNBLG1CQUFBQSxnQkFBQTtBQUNBLFNBSkEsQ0FBQTtBQUtBLEtBTkE7O0FBUUFDLHdCQUFBN00sVUFBQSxHQUFBLFVBQUFDLFdBQUEsRUFBQTtBQUNBLGVBQUFvRSxNQUFBRixHQUFBLENBQUF5RyxVQUFBLFlBQUEsR0FBQTNLLFdBQUEsRUFDQXpCLElBREEsQ0FDQXNNLE9BREEsQ0FBQTtBQUVBLEtBSEE7O0FBS0ErQix3QkFBQXhNLFFBQUEsR0FBQSxVQUFBSixXQUFBLEVBQUE7QUFDQSxlQUFBb0UsTUFBQUYsR0FBQSxDQUFBeUcsVUFBQSxPQUFBLEdBQUEzSyxXQUFBLEVBQ0F6QixJQURBLENBQ0FzTSxPQURBLENBQUE7QUFFQSxLQUhBOztBQUtBK0Isd0JBQUFDLFlBQUEsR0FBQSxVQUFBN00sV0FBQSxFQUFBbEMsSUFBQSxFQUFBO0FBQ0EsZUFBQXNHLE1BQUE4SCxHQUFBLENBQUF2QixVQUFBLFlBQUEsR0FBQTNLLFdBQUEsRUFBQWxDLElBQUEsRUFDQVMsSUFEQSxDQUNBc00sT0FEQSxFQUVBdE0sSUFGQSxDQUVBLFVBQUF1TyxTQUFBLEVBQUE7QUFDQTNFLHdCQUFBQyxLQUFBLENBQUEsU0FBQSxFQUFBLElBQUE7QUFDQSxnQkFBQTJFLGFBQUFKLGlCQUFBTCxTQUFBLENBQUEsVUFBQVEsU0FBQSxFQUFBO0FBQ0EsdUJBQUFBLFVBQUF0SSxFQUFBLEtBQUF4RSxXQUFBO0FBQ0EsYUFGQSxDQUFBO0FBR0EyTSw2QkFBQUksVUFBQSxJQUFBRCxTQUFBO0FBQ0EsbUJBQUFBLFNBQUE7QUFDQSxTQVRBLENBQUE7QUFVQSxLQVhBO0FBWUFGLHdCQUFBSSxlQUFBLEdBQUEsVUFBQWhOLFdBQUEsRUFBQTtBQUNBLGVBQUFvRSxNQUFBbUgsTUFBQSxDQUFBWixVQUFBLFlBQUEsR0FBQTNLLFdBQUEsRUFDQTZMLE9BREEsQ0FDQSxZQUFBO0FBQ0ExRCx3QkFBQUMsS0FBQSxDQUFBLFNBQUEsRUFBQSxJQUFBO0FBQ0EsZ0JBQUE2RSxhQUFBTixpQkFBQUwsU0FBQSxDQUFBLFVBQUFRLFNBQUEsRUFBQTtBQUNBLHVCQUFBQSxVQUFBdEksRUFBQSxLQUFBeEUsV0FBQTtBQUNBLGFBRkEsQ0FBQTtBQUdBMk0sNkJBQUFOLE1BQUEsQ0FBQVksVUFBQSxFQUFBLENBQUE7QUFDQSxTQVBBLENBQUE7QUFRQSxLQVRBOztBQVdBLFdBQUFMLG1CQUFBO0FBRUEsQ0EzREE7O0FDQUFsUSxJQUFBb0csT0FBQSxDQUFBLGdCQUFBLEVBQUEsVUFBQXNCLEtBQUEsRUFBQTs7QUFHQSxRQUFBdUcsVUFBQSxnQkFBQTtBQUNBLFFBQUFFLFVBQUEsU0FBQUEsT0FBQTtBQUFBLGVBQUFDLElBQUFoTixJQUFBO0FBQUEsS0FBQTtBQUNBLFFBQUFvUCxlQUFBLFNBQUFBLFlBQUEsQ0FBQUMsTUFBQSxFQUFBO0FBQ0EsWUFBQTVILE9BQUE0SCxPQUFBQyxTQUFBLENBQUFDLE1BQUEsQ0FBQSxDQUFBLEVBQUEsRUFBQSxDQUFBO0FBQ0FGLGVBQUE1SCxJQUFBLEdBQUFBLElBQUE7QUFDQSxlQUFBNEgsTUFBQTtBQUNBLEtBSkE7O0FBTUEsUUFBQWxNLGlCQUFBLEVBQUE7QUFDQUEsbUJBQUFxTSxjQUFBLEdBQUEsRUFBQTtBQUNBck0sbUJBQUErSSxhQUFBLEdBQUEsRUFBQTs7QUFFQS9JLG1CQUFBQyxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUFrRCxNQUFBRixHQUFBLENBQUF5RyxPQUFBLEVBQUFwTSxJQUFBLENBQUFzTSxPQUFBLEVBQ0F0TSxJQURBLENBQ0EsVUFBQW1CLFFBQUEsRUFBQTtBQUNBLG1CQUFBQSxTQUFBaUIsR0FBQSxDQUFBTSxlQUFBa0ssT0FBQSxDQUFBO0FBQ0EsU0FIQSxFQUdBNU0sSUFIQSxDQUdBLFVBQUFtQixRQUFBLEVBQUE7QUFDQS9DLG9CQUFBb08sSUFBQSxDQUFBckwsUUFBQSxFQUFBdUIsZUFBQXFNLGNBQUEsRUFEQSxDQUNBO0FBQ0FyTSwyQkFBQXFNLGNBQUEsQ0FBQWpOLElBQUEsQ0FBQSxVQUFBQyxDQUFBLEVBQUFDLENBQUEsRUFBQTtBQUNBLHVCQUFBRCxFQUFBa0UsRUFBQSxHQUFBakUsRUFBQWlFLEVBQUE7QUFDQSxhQUZBO0FBR0EsbUJBQUF2RCxlQUFBcU0sY0FBQTtBQUNBLFNBVEEsQ0FBQTtBQVVBLEtBWEE7O0FBYUFyTSxtQkFBQXNNLGFBQUEsR0FBQSxVQUFBL0ksRUFBQSxFQUFBMUcsSUFBQSxFQUFBO0FBQ0EsZUFBQXNHLE1BQUE4SCxHQUFBLENBQUF2QixVQUFBbkcsRUFBQSxFQUFBMUcsSUFBQSxFQUNBUyxJQURBLENBQ0FzTSxPQURBLEVBRUF0TSxJQUZBLENBRUEwQyxlQUFBa0ssT0FGQSxFQUdBNU0sSUFIQSxDQUdBLFVBQUFtTCxPQUFBLEVBQUE7QUFDQXZCLHdCQUFBQyxLQUFBLENBQUEsU0FBQSxFQUFBLElBQUE7QUFDQSxnQkFBQTJFLGFBQUE5TCxlQUFBcU0sY0FBQSxDQUFBaEIsU0FBQSxDQUFBLFVBQUE1QyxPQUFBLEVBQUE7QUFDQSx1QkFBQUEsUUFBQWxGLEVBQUEsS0FBQUEsRUFBQTtBQUNBLGFBRkEsQ0FBQTtBQUdBdkQsMkJBQUFxTSxjQUFBLENBQUFQLFVBQUEsSUFBQXJELE9BQUE7QUFDQSxtQkFBQUEsT0FBQTtBQUNBLFNBVkEsQ0FBQTtBQVdBLEtBWkE7O0FBY0F6SSxtQkFBQXVNLGFBQUEsR0FBQSxVQUFBaEosRUFBQSxFQUFBO0FBQ0EsZUFBQUosTUFBQW1ILE1BQUEsQ0FBQVosVUFBQW5HLEVBQUEsRUFBQXFILE9BQUEsQ0FBQSxZQUFBO0FBQ0ExRCx3QkFBQUMsS0FBQSxDQUFBLFNBQUEsRUFBQSxJQUFBO0FBQ0EsZ0JBQUE2RSxhQUFBaE0sZUFBQXFNLGNBQUEsQ0FBQWhCLFNBQUEsQ0FBQSxVQUFBNUMsT0FBQSxFQUFBO0FBQ0EsdUJBQUFBLFFBQUFsRixFQUFBLEtBQUFBLEVBQUE7QUFDQSxhQUZBLENBQUE7QUFHQXZELDJCQUFBcU0sY0FBQSxDQUFBakIsTUFBQSxDQUFBWSxVQUFBLEVBQUEsQ0FBQTtBQUNBLFNBTkEsQ0FBQTtBQU9BLEtBUkE7O0FBVUFoTSxtQkFBQW9KLFNBQUEsR0FBQSxVQUFBN0YsRUFBQSxFQUFBO0FBQ0EsZUFBQUosTUFBQUYsR0FBQSxDQUFBeUcsVUFBQW5HLEVBQUEsRUFDQWpHLElBREEsQ0FDQXNNLE9BREEsRUFFQXRNLElBRkEsQ0FFQTBDLGVBQUFrSyxPQUZBLENBQUE7QUFJQSxLQUxBOztBQU9BbEssbUJBQUFrSyxPQUFBLEdBQUEsVUFBQXpCLE9BQUEsRUFBQTtBQUNBQSxnQkFBQTBCLFFBQUEsR0FBQVQsVUFBQWpCLFFBQUFsRixFQUFBLEdBQUEsUUFBQTtBQUNBLGVBQUFrRixPQUFBO0FBQ0EsS0FIQTs7QUFLQXpJLG1CQUFBOEksWUFBQSxHQUFBLFVBQUFELFNBQUEsRUFBQWhNLElBQUEsRUFBQTtBQUNBLGVBQUFzRyxNQUFBUyxJQUFBLENBQUEsa0JBQUFpRixTQUFBLEVBQUFoTSxJQUFBLEVBQ0FTLElBREEsQ0FDQSxVQUFBcUYsUUFBQSxFQUFBO0FBQ0EsZ0JBQUF1SixTQUFBRCxhQUFBdEosU0FBQTlGLElBQUEsQ0FBQTtBQUNBbUQsMkJBQUErSSxhQUFBLENBQUF2SCxJQUFBLENBQUEwSyxNQUFBO0FBQ0EsbUJBQUFBLE1BQUE7QUFDQSxTQUxBLENBQUE7QUFNQSxLQVBBOztBQVNBbE0sbUJBQUFxSixlQUFBLEdBQUEsVUFBQVIsU0FBQSxFQUFBO0FBQ0EsZUFBQTFGLE1BQUFGLEdBQUEsQ0FBQSxrQkFBQTRGLFNBQUEsRUFDQXZMLElBREEsQ0FDQSxVQUFBcUYsUUFBQSxFQUFBO0FBQ0FqSCxvQkFBQW9PLElBQUEsQ0FBQW5ILFNBQUE5RixJQUFBLEVBQUFtRCxlQUFBK0ksYUFBQTtBQUNBLG1CQUFBL0ksZUFBQStJLGFBQUEsQ0FBQXJKLEdBQUEsQ0FBQXVNLFlBQUEsQ0FBQTtBQUNBLFNBSkEsQ0FBQTtBQUtBLEtBTkE7O0FBUUEsV0FBQWpNLGNBQUE7QUFFQSxDQW5GQTs7QUNBQXZFLElBQUFvRyxPQUFBLENBQUEsYUFBQSxFQUFBLFVBQUFzQixLQUFBLEVBQUE7QUFDQSxRQUFBakQsY0FBQSxFQUFBOztBQUVBLFFBQUFzTSxjQUFBLEVBQUE7QUFDQSxRQUFBOUMsVUFBQSxhQUFBO0FBQ0EsUUFBQUUsVUFBQSxTQUFBQSxPQUFBO0FBQUEsZUFBQUMsSUFBQWhOLElBQUE7QUFBQSxLQUFBOztBQUVBcUQsZ0JBQUFELFFBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQWtELE1BQUFGLEdBQUEsQ0FBQXlHLE9BQUEsRUFBQXBNLElBQUEsQ0FBQXNNLE9BQUEsRUFDQXRNLElBREEsQ0FDQSxVQUFBb0IsS0FBQSxFQUFBO0FBQ0FoRCxvQkFBQW9PLElBQUEsQ0FBQXBMLEtBQUEsRUFBQThOLFdBQUEsRUFEQSxDQUNBO0FBQ0FBLHdCQUFBcE4sSUFBQSxDQUFBLFVBQUFDLENBQUEsRUFBQUMsQ0FBQSxFQUFBO0FBQ0EsdUJBQUFELEVBQUFrRSxFQUFBLEdBQUFqRSxFQUFBaUUsRUFBQTtBQUNBLGFBRkE7QUFHQSxtQkFBQWlKLFdBQUE7QUFDQSxTQVBBLENBQUE7QUFRQSxLQVRBOztBQVdBdE0sZ0JBQUF1TSxVQUFBLEdBQUEsVUFBQWxKLEVBQUEsRUFBQTFHLElBQUEsRUFBQTtBQUNBLGVBQUFzRyxNQUFBOEgsR0FBQSxDQUFBdkIsVUFBQW5HLEVBQUEsRUFBQTFHLElBQUEsRUFDQVMsSUFEQSxDQUNBc00sT0FEQSxFQUVBdE0sSUFGQSxDQUVBLFVBQUFDLElBQUEsRUFBQTtBQUNBLGdCQUFBdU8sYUFBQVUsWUFBQW5CLFNBQUEsQ0FBQSxVQUFBOU4sSUFBQSxFQUFBO0FBQ0EsdUJBQUFBLEtBQUFnRyxFQUFBLEtBQUFBLEVBQUE7QUFDQSxhQUZBLENBQUE7QUFHQWlKLHdCQUFBVixVQUFBLElBQUF2TyxJQUFBO0FBQ0EsbUJBQUFBLElBQUE7QUFDQSxTQVJBLENBQUE7QUFTQSxLQVZBOztBQVlBMkMsZ0JBQUF3TSxVQUFBLEdBQUEsVUFBQW5KLEVBQUEsRUFBQTtBQUNBLGVBQUFKLE1BQUFtSCxNQUFBLENBQUFaLFVBQUFuRyxFQUFBLEVBQUFxSCxPQUFBLENBQUEsWUFBQTtBQUNBLGdCQUFBb0IsYUFBQVEsWUFBQW5CLFNBQUEsQ0FBQSxVQUFBOU4sSUFBQSxFQUFBO0FBQ0EsdUJBQUFBLEtBQUFnRyxFQUFBLEtBQUFBLEVBQUE7QUFDQSxhQUZBLENBQUE7QUFHQWlKLHdCQUFBcEIsTUFBQSxDQUFBWSxVQUFBLEVBQUEsQ0FBQTtBQUNBLFNBTEEsQ0FBQTtBQU1BLEtBUEE7O0FBU0E5TCxnQkFBQTZILHVCQUFBLEdBQUEsVUFBQTRFLE9BQUEsRUFBQTtBQUNBLGVBQUF4SixNQUFBRixHQUFBLENBQUF5RyxVQUFBLG1CQUFBLEVBQ0FwTSxJQURBLENBQ0FzTSxPQURBLEVBRUF0TSxJQUZBLENBRUEsVUFBQUMsSUFBQSxFQUFBO0FBQ0EsZ0JBQUFBLEtBQUFnRyxFQUFBLEtBQUEsU0FBQSxFQUFBO0FBQ0EsdUJBQUFKLE1BQUE4SCxHQUFBLENBQUEsbUNBQUEsRUFBQTBCLE9BQUEsQ0FBQTtBQUNBLGFBRkEsTUFHQTtBQUNBLHVCQUFBek0sWUFBQXVNLFVBQUEsQ0FBQWxQLEtBQUFnRyxFQUFBLEVBQUFvSixPQUFBLEVBQ0FyUCxJQURBLENBQ0EsWUFBQTtBQUNBLDJCQUFBNkYsTUFBQThILEdBQUEsQ0FBQSxnQ0FBQSxFQUFBMEIsT0FBQSxDQUFBO0FBQ0EsaUJBSEEsQ0FBQTtBQUlBO0FBQ0EsU0FaQSxDQUFBO0FBYUEsS0FkQTs7QUFnQkEsV0FBQXpNLFdBQUE7QUFDQSxDQXhEQTs7QUNBQXpFLElBQUFnSixTQUFBLENBQUEsY0FBQSxFQUFBLFVBQUFwRSxXQUFBLEVBQUE3RCxVQUFBLEVBQUE7QUFDQSxXQUFBO0FBQ0E2SixrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSxtREFGQTtBQUdBK0ksZUFBQTtBQUNBZ0csb0JBQUE7QUFEQSxTQUhBO0FBTUFDLGNBQUEsY0FBQWpHLEtBQUEsRUFBQWtHLElBQUEsRUFBQUMsSUFBQSxFQUFBO0FBQ0FuRyxrQkFBQW9HLFFBQUEsR0FBQSxVQUFBO0FBQ0EzTSx3QkFBQWMsZ0JBQUEsR0FBQTdELElBQUEsQ0FBQSxVQUFBMkQsSUFBQSxFQUFBO0FBQ0EyRixzQkFBQTNGLElBQUEsR0FBQVosWUFBQVMsVUFBQTtBQUNBLGFBRkE7QUFHQXRFLHVCQUFBTyxHQUFBLENBQUEsWUFBQSxFQUFBLFVBQUFDLEtBQUEsRUFBQWlFLElBQUEsRUFBQTtBQUNBMkYsc0JBQUEzRixJQUFBLEdBQUFBLElBQUE7QUFDQSxhQUZBO0FBR0EyRixrQkFBQXFHLFVBQUEsR0FBQSxZQUFBO0FBQ0FyRyxzQkFBQW9HLFFBQUEsR0FBQSwyQkFBQTtBQUNBLGFBRkE7QUFHQXBHLGtCQUFBc0csUUFBQSxHQUFBLFlBQUE7QUFDQXRHLHNCQUFBZ0csTUFBQSxHQUFBLFVBQUE7QUFDQWhHLHNCQUFBb0csUUFBQSxHQUFBLFVBQUE7QUFDQSxhQUhBO0FBSUFwRyxrQkFBQTVGLEtBQUEsR0FBQSxZQUFBO0FBQ0Esb0JBQUFBLFFBQUEsQ0FBQTtBQUNBLG9CQUFBNEYsTUFBQTNGLElBQUEsRUFDQTJGLE1BQUEzRixJQUFBLENBQUFyQyxPQUFBLENBQUE7QUFBQSwyQkFBQW9DLFNBQUFrSCxLQUFBaEgsS0FBQSxHQUFBZ0gsS0FBQXRILFFBQUE7QUFBQSxpQkFBQTtBQUNBLHVCQUFBSSxLQUFBO0FBQ0EsYUFMQTtBQU1BO0FBM0JBLEtBQUE7QUE2QkEsQ0E5QkE7O0FDQUF2RixJQUFBZ0osU0FBQSxDQUFBLGVBQUEsRUFBQSxZQUFBO0FBQ0EsV0FBQTtBQUNBNEIsa0JBQUEsR0FEQTtBQUVBeEkscUJBQUE7QUFGQSxLQUFBO0FBSUEsQ0FMQTtBQ0FBcEMsSUFBQWdKLFNBQUEsQ0FBQSxRQUFBLEVBQUEsVUFBQWpJLFVBQUEsRUFBQUMsV0FBQSxFQUFBK0YsV0FBQSxFQUFBOUYsTUFBQSxFQUFBOztBQUVBLFdBQUE7QUFDQTJKLGtCQUFBLEdBREE7QUFFQU8sZUFBQSxFQUZBO0FBR0EvSSxxQkFBQSx5Q0FIQTtBQUlBZ1AsY0FBQSxjQUFBakcsS0FBQSxFQUFBOztBQUVBQSxrQkFBQXhGLEtBQUEsR0FBQSxDQUNBLEVBQUErTCxPQUFBLE1BQUEsRUFBQXZRLE9BQUEsT0FBQSxFQURBLENBQUE7O0FBS0FnSyxrQkFBQXdHLFVBQUEsR0FBQSxZQUFBO0FBQ0EzTixrQkFBQSxtQkFBQSxFQUFBNE4sR0FBQSxDQUFBLHFCQUFBLEVBQUEsZUFBQTtBQUVBLGFBSEE7O0FBS0F6RyxrQkFBQTBHLFlBQUEsR0FBQSxZQUFBO0FBQ0E3TixrQkFBQSxtQkFBQSxFQUFBNE4sR0FBQSxDQUFBLHFCQUFBLEVBQUEsYUFBQTtBQUVBLGFBSEE7O0FBS0F6RyxrQkFBQXJKLElBQUEsR0FBQSxJQUFBO0FBQ0FxSixrQkFBQTJHLEtBQUEsR0FBQSxJQUFBOztBQUVBM0csa0JBQUE0RyxVQUFBLEdBQUEsWUFBQTtBQUNBLHVCQUFBL1EsWUFBQVUsZUFBQSxFQUFBO0FBQ0EsYUFGQTs7QUFJQXlKLGtCQUFBOUMsTUFBQSxHQUFBLFlBQUE7QUFDQXJILDRCQUFBcUgsTUFBQSxHQUFBeEcsSUFBQSxDQUFBLFlBQUE7QUFDQVosMkJBQUFjLEVBQUEsQ0FBQSxNQUFBO0FBQ0EsaUJBRkE7QUFHQSxhQUpBOztBQU1BLGdCQUFBaVEsVUFBQSxTQUFBQSxPQUFBLEdBQUE7QUFDQWhSLDRCQUFBWSxlQUFBLEdBQUFDLElBQUEsQ0FBQSxVQUFBQyxJQUFBLEVBQUE7QUFDQXFKLDBCQUFBckosSUFBQSxHQUFBQSxJQUFBO0FBQ0EsaUJBRkE7QUFHQSxhQUpBOztBQU1BLGdCQUFBbVEsYUFBQSxTQUFBQSxVQUFBLEdBQUE7QUFDQTlHLHNCQUFBckosSUFBQSxHQUFBLElBQUE7QUFDQSxhQUZBOztBQUlBLGdCQUFBb1EsV0FBQSxTQUFBQSxRQUFBLEdBQUE7QUFDQTtBQUNBbFIsNEJBQUFZLGVBQUEsR0FBQUMsSUFBQSxDQUFBLFVBQUFDLElBQUEsRUFBQTtBQUNBcUosMEJBQUEyRyxLQUFBLEdBQUE5USxZQUFBK0csT0FBQSxDQUFBakcsSUFBQSxDQUFBO0FBQ0EsaUJBRkE7QUFHQSxhQUxBOztBQU9Ba1E7QUFDQUU7O0FBRUFuUix1QkFBQU8sR0FBQSxDQUFBeUYsWUFBQVAsWUFBQSxFQUFBd0wsT0FBQTtBQUNBalIsdUJBQUFPLEdBQUEsQ0FBQXlGLFlBQUFMLGFBQUEsRUFBQXVMLFVBQUE7QUFDQWxSLHVCQUFBTyxHQUFBLENBQUF5RixZQUFBSixjQUFBLEVBQUFzTCxVQUFBO0FBRUE7O0FBMURBLEtBQUE7QUE4REEsQ0FoRUE7O0FDQUE7O0FBRUFqUyxJQUFBZ0osU0FBQSxDQUFBLGFBQUEsRUFBQSxZQUFBO0FBQ0EsV0FBQTtBQUNBbUMsZUFBQTtBQUNBZ0gsMEJBQUE7QUFEQSxTQURBO0FBSUF2SCxrQkFBQSxHQUpBO0FBS0F4SSxxQkFBQTtBQUxBLEtBQUE7QUFPQSxDQVJBOztBQ0ZBcEMsSUFBQWdKLFNBQUEsQ0FBQSxZQUFBLEVBQUEsVUFBQWpHLG1CQUFBLEVBQUE7QUFDQSxXQUFBO0FBQ0E2SCxrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSxtREFGQTtBQUdBK0ksZUFBQTtBQUNBaUgsMEJBQUE7QUFEQSxTQUhBO0FBTUFoQixjQUFBLGNBQUFpQixDQUFBLEVBQUFuSCxDQUFBLEVBQUF0SCxDQUFBLEVBQUE7QUFDQVEsb0JBQUFDLEdBQUEsQ0FBQWdPLEVBQUFELFlBQUE7QUFDQTtBQVJBLEtBQUE7QUFVQSxDQVhBOztBQ0FBcFMsSUFBQW1DLFVBQUEsQ0FBQSxrQkFBQSxFQUFBLFVBQUFFLE1BQUEsRUFBQSxDQUVBLENBRkE7QUNBQXJDLElBQUFnSixTQUFBLENBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQSxXQUFBO0FBQ0E0QixrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSx1REFGQTtBQUdBK0ksZUFBQTtBQUNBbUgsdUJBQUE7QUFEQSxTQUhBO0FBTUFuUSxvQkFBQTtBQU5BLEtBQUE7QUFRQSxDQVRBOztBQ0FBbkMsSUFBQW1DLFVBQUEsQ0FBQSxpQkFBQSxFQUFBLFVBQUFFLE1BQUEsRUFBQTs7QUFHQUEsV0FBQWtRLFVBQUEsR0FBQSxDQUNBLEVBQUF2USxNQUFBLEtBQUEsRUFEQSxFQUVBLEVBQUFBLE1BQUEsTUFBQSxFQUZBLEVBR0EsRUFBQUEsTUFBQSxPQUFBLEVBSEEsRUFJQSxFQUFBQSxNQUFBLE9BQUEsRUFKQSxFQUtBLEVBQUFBLE1BQUEsTUFBQSxFQUxBLEVBTUEsRUFBQUEsTUFBQSxRQUFBLEVBTkEsRUFPQSxFQUFBQSxNQUFBLFNBQUEsRUFQQSxFQVFBLEVBQUFBLE1BQUEsS0FBQSxFQVJBLEVBU0EsRUFBQUEsTUFBQSxRQUFBLEVBVEEsRUFVQSxFQUFBQSxNQUFBLEtBQUEsRUFWQSxFQVdBLEVBQUFBLE1BQUEsVUFBQSxFQVhBLEVBWUEsRUFBQUEsTUFBQSxRQUFBLEVBWkEsRUFhQSxFQUFBQSxNQUFBLE9BQUEsRUFiQSxFQWNBLEVBQUFBLE1BQUEsVUFBQSxFQWRBLEVBZUEsRUFBQUEsTUFBQSxPQUFBLEVBZkEsRUFnQkEsRUFBQUEsTUFBQSxRQUFBLEVBaEJBLENBQUE7O0FBbUJBSyxXQUFBMk0sTUFBQSxHQUFBLFVBQUF3RCxRQUFBLEVBQUE7QUFDQSxlQUFBLFVBQUF4RixPQUFBLEVBQUE7QUFDQSxnQkFBQSxDQUFBd0YsUUFBQSxJQUFBQSxhQUFBLEtBQUEsRUFBQSxPQUFBLElBQUEsQ0FBQSxLQUNBLE9BQUF4RixRQUFBd0YsUUFBQSxLQUFBQSxRQUFBO0FBQ0EsU0FIQTtBQUlBLEtBTEE7QUFNQW5RLFdBQUFvUSxZQUFBLEdBQUEsVUFBQUMsYUFBQSxFQUFBO0FBQ0EsZUFBQSxVQUFBMUYsT0FBQSxFQUFBO0FBQ0EsZ0JBQUEsQ0FBQTBGLGFBQUEsRUFBQSxPQUFBLElBQUEsQ0FBQSxLQUNBO0FBQ0Esb0JBQUFDLE1BQUFELGNBQUEzSSxNQUFBO0FBQ0EzRix3QkFBQUMsR0FBQSxDQUFBLFNBQUEsRUFBQTJJLFFBQUFOLEtBQUE7QUFDQSx1QkFBQU0sUUFBQU4sS0FBQSxDQUFBa0csU0FBQSxDQUFBLENBQUEsRUFBQUQsR0FBQSxFQUFBRSxXQUFBLE1BQUFILGNBQUFHLFdBQUEsRUFBQTtBQUNBO0FBRUEsU0FSQTtBQVNBLEtBVkE7QUFXQXhRLFdBQUF5USxnQkFBQSxHQUFBLFlBQUE7QUFBQSxZQUFBQyxHQUFBLHlEQUFBLENBQUE7QUFBQSxZQUFBQyxHQUFBLHlEQUFBLElBQUE7O0FBQ0EsZUFBQSxVQUFBaEcsT0FBQSxFQUFBO0FBQ0EsbUJBQUFBLFFBQUF2SCxLQUFBLElBQUFzTixHQUFBLElBQUEvRixRQUFBdkgsS0FBQSxJQUFBdU4sR0FBQTtBQUNBLFNBRkE7QUFHQSxLQUpBO0FBS0EzUSxXQUFBNFEsV0FBQSxHQUFBLFlBQUE7QUFBQSxZQUFBQyxRQUFBLHlEQUFBLFdBQUE7O0FBQ0EsWUFBQUEsYUFBQSxXQUFBLEVBQUEsT0FBQSxJQUFBLENBQUEsS0FDQSxJQUFBQSxhQUFBLEtBQUEsRUFBQSxPQUFBLE9BQUEsQ0FBQSxLQUNBLElBQUFBLGFBQUEsTUFBQSxFQUFBLE9BQUEsUUFBQTtBQUNBLEtBSkE7QUFLQSxDQWpEQTs7QUNBQWxULElBQUFnSixTQUFBLENBQUEsYUFBQSxFQUFBLFlBQUE7QUFDQSxXQUFBO0FBQ0E0QixrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSxxREFGQTtBQUdBK0ksZUFBQTtBQUNBbkksc0JBQUE7QUFEQSxTQUhBO0FBTUFiLG9CQUFBO0FBTkEsS0FBQTtBQVFBLENBVEE7O0FDQUFuQyxJQUFBZ0osU0FBQSxDQUFBLGNBQUEsRUFBQSxVQUFBekUsY0FBQSxFQUFBO0FBQ0EsV0FBQTtBQUNBcUcsa0JBQUEsR0FEQTtBQUVBeEkscUJBQUEsdURBRkE7QUFHQStJLGVBQUE7QUFDQTZCLHFCQUFBLEdBREE7QUFFQW1HLHFCQUFBO0FBRkEsU0FIQTtBQU9BL0IsY0FBQSxjQUFBakcsS0FBQSxFQUFBa0csSUFBQSxFQUFBQyxJQUFBLEVBQUE7QUFDQW5HLGtCQUFBaUksWUFBQSxHQUFBLFVBQUF0TCxFQUFBLEVBQUE7QUFDQXZELCtCQUFBc00sYUFBQSxDQUFBL0ksRUFBQSxFQUFBcUQsTUFBQWdJLE9BQUE7QUFDQSxhQUZBO0FBR0FoSSxrQkFBQTJGLGFBQUEsR0FBQSxVQUFBaEosRUFBQSxFQUFBO0FBQ0F2RCwrQkFBQXVNLGFBQUEsQ0FBQWhKLEVBQUE7QUFDQSxhQUZBO0FBR0E7QUFkQSxLQUFBO0FBZ0JBLENBakJBOztBQ0FBOUgsSUFBQWdKLFNBQUEsQ0FBQSxlQUFBLEVBQUEsVUFBQXFLLGVBQUEsRUFBQTs7QUFFQSxXQUFBO0FBQ0F6SSxrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSx5REFGQTtBQUdBZ1AsY0FBQSxjQUFBakcsS0FBQSxFQUFBO0FBQ0FBLGtCQUFBbUksUUFBQSxHQUFBRCxnQkFBQTdFLGlCQUFBLEVBQUE7QUFDQTtBQUxBLEtBQUE7QUFRQSxDQVZBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUNGQXhPLElBQUFnSixTQUFBLENBQUEsV0FBQSxFQUFBLFlBQUE7QUFDQSxXQUFBO0FBQ0E0QixrQkFBQSxHQURBO0FBRUF4SSxxQkFBQSxpREFGQTtBQUdBRCxvQkFBQTtBQUhBLEtBQUE7QUFLQSxDQU5BOztBQ0FBbkMsSUFBQWdKLFNBQUEsQ0FBQSxXQUFBLEVBQUEsVUFBQXZFLFdBQUEsRUFBQTJHLFdBQUEsRUFBQTtBQUNBLFdBQUE7QUFDQVIsa0JBQUEsR0FEQTtBQUVBeEkscUJBQUEsaURBRkE7QUFHQStJLGVBQUE7QUFDQXJKLGtCQUFBLEdBREE7QUFFQXFSLHFCQUFBO0FBRkEsU0FIQTtBQU9BL0IsY0FBQSxjQUFBakcsS0FBQSxFQUFBa0csSUFBQSxFQUFBQyxJQUFBLEVBQUE7QUFDQW5HLGtCQUFBSSxjQUFBLEdBQUEsVUFBQUMsS0FBQSxFQUFBO0FBQ0FKLDRCQUFBRyxjQUFBLENBQUEsRUFBQUMsT0FBQUEsS0FBQSxFQUFBLEVBQUEzSixJQUFBLENBQUEsWUFBQTtBQUNBNEosZ0NBQUFDLEtBQUEsQ0FBQSxNQUFBLEVBQUEsSUFBQTtBQUNBLGlCQUZBLEVBRUFsSSxLQUZBLENBRUEsWUFBQTtBQUNBaUksZ0NBQUFDLEtBQUEsQ0FBQSw0QkFBQSxFQUFBLElBQUE7QUFDQSxpQkFKQTtBQUtBLGFBTkE7QUFPQVAsa0JBQUE4RixVQUFBLEdBQUEsVUFBQXNDLE1BQUEsRUFBQTtBQUNBOU8sNEJBQUF3TSxVQUFBLENBQUFzQyxNQUFBLEVBQUExUixJQUFBLENBQUEsWUFBQTtBQUNBNEosZ0NBQUFDLEtBQUEsQ0FBQSx5QkFBQSxFQUFBLElBQUE7QUFDQSxpQkFGQSxFQUVBbEksS0FGQSxDQUVBLFlBQUE7QUFDQWlJLGdDQUFBQyxLQUFBLENBQUEsNEJBQUEsRUFBQSxJQUFBO0FBQ0EsaUJBSkE7QUFLQSxhQU5BO0FBT0E7QUF0QkEsS0FBQTtBQXdCQSxDQXpCQTs7QUNBQTFMLElBQUFnSixTQUFBLENBQUEsV0FBQSxFQUFBLFVBQUFqRyxtQkFBQSxFQUFBO0FBQ0EsV0FBQTtBQUNBNkgsa0JBQUEsR0FEQTtBQUVBeEkscUJBQUEsaURBRkE7QUFHQStJLGVBQUE7QUFDQWlGLHVCQUFBLEdBREE7QUFFQStDLHFCQUFBO0FBRkEsU0FIQTtBQU9BL0IsY0FBQSxjQUFBakcsS0FBQSxFQUFBa0csSUFBQSxFQUFBQyxJQUFBLEVBQUE7QUFDQW5HLGtCQUFBZ0YsWUFBQSxHQUFBLFVBQUFySSxFQUFBLEVBQUE7QUFDQS9FLG9DQUFBb04sWUFBQSxDQUFBckksRUFBQSxFQUFBcUQsTUFBQWdJLE9BQUE7QUFDQSxhQUZBO0FBR0FoSSxrQkFBQW1GLGVBQUEsR0FBQSxVQUFBeEksRUFBQSxFQUFBO0FBQ0EvRSxvQ0FBQXVOLGVBQUEsQ0FBQXhJLEVBQUE7QUFDQSxhQUZBO0FBR0E7QUFkQSxLQUFBO0FBZ0JBLENBakJBOztBQ0NBOUgsSUFBQWdKLFNBQUEsQ0FBQSxzQkFBQSxFQUFBLFVBQUF3SyxTQUFBLEVBQUE7QUFDQSxXQUFBO0FBQ0E1SSxrQkFBQSxHQURBO0FBRUFPLGVBQUE7QUFDQXNJLGtDQUFBO0FBREEsU0FGQTtBQUtBckMsY0FBQSxjQUFBakcsS0FBQSxFQUFBdUksRUFBQSxFQUFBcEMsSUFBQSxFQUFBOztBQUVBdE4sY0FBQSxPQUFBLEVBQUFpSCxFQUFBLENBQUEsT0FBQSxFQUFBLFVBQUFDLENBQUEsRUFBQTtBQUNBQSxrQkFBQXlJLGVBQUE7QUFDQSxhQUZBOztBQU1BSCxzQkFBQXZJLEVBQUEsQ0FBQSxPQUFBLEVBQUEsVUFBQUMsQ0FBQSxFQUFBO0FBQ0Esb0JBQUFBLEVBQUEwSSxNQUFBLENBQUE5TCxFQUFBLEtBQUEsV0FBQSxJQUFBb0QsRUFBQTBJLE1BQUEsQ0FBQTlMLEVBQUEsS0FBQSxvQkFBQSxFQUFBO0FBQ0Esd0JBQUE0TCxPQUFBeEksRUFBQTBJLE1BQUEsSUFBQSxDQUFBRixHQUFBLENBQUEsRUFBQUcsUUFBQSxDQUFBM0ksRUFBQTBJLE1BQUEsQ0FBQSxFQUFBO0FBQ0F6SSw4QkFBQTJJLE1BQUEsQ0FBQSxZQUFBOztBQUVBM0ksa0NBQUE0SSxLQUFBLENBQUE1SSxNQUFBc0ksb0JBQUE7QUFDQSx5QkFIQTtBQUlBO0FBQ0E7QUFDQSxhQVRBO0FBV0E7QUF4QkEsS0FBQTtBQTBCQSxDQTNCQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG53aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ0Z1bGxzdGFja0dlbmVyYXRlZEFwcCcsIFsnZnNhUHJlQnVpbHQnLCAndWkucm91dGVyJywgJ3VpLmJvb3RzdHJhcCcsICduZ0FuaW1hdGUnLCAndWkubWF0ZXJpYWxpemUnLCAnYW5ndWxhci1pbnB1dC1zdGFycycsJ2FuZ3VsYXItc3RyaXBlJ10pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyLCAkdWlWaWV3U2Nyb2xsUHJvdmlkZXIsc3RyaXBlUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbiAgICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAgICR1cmxSb3V0ZXJQcm92aWRlci53aGVuKCcvYXV0aC86cHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9KTtcbiAgICAkdWlWaWV3U2Nyb2xsUHJvdmlkZXIudXNlQW5jaG9yU2Nyb2xsKCk7XG5cbiAgICAvLyBzdHJpcGVQcm92aWRlci5zZXRQdWJsaXNoYWJsZUtleSgnbXlfa2V5Jyk7XG5cbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGNvbnRyb2xsaW5nIGFjY2VzcyB0byBzcGVjaWZpYyBzdGF0ZXMuXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlO1xuICAgIH07XG5cbiAgICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAgIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMpIHtcblxuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAvLyBSZWdpc3RlciBvdXIgKmFib3V0KiBzdGF0ZS5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnYWJvdXQnLCB7XG4gICAgICAgIHVybDogJy9hYm91dCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdBYm91dENvbnRyb2xsZXInLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2Fib3V0L2Fib3V0Lmh0bWwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignQWJvdXRDb250cm9sbGVyJywgZnVuY3Rpb24gKCRzY29wZSwgRnVsbHN0YWNrUGljcykge1xuXG4gICAgLy8gSW1hZ2VzIG9mIGJlYXV0aWZ1bCBGdWxsc3RhY2sgcGVvcGxlLlxuICAgICRzY29wZS5pbWFnZXMgPSBfLnNodWZmbGUoRnVsbHN0YWNrUGljcyk7XG5cbn0pOyIsIlxuYXBwLmNvbnRyb2xsZXIoJ0FkbWluQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIGFsbFVzZXJPcmRlcnMsICRsb2csIGFsbFByb2R1Y3RzLCBhbGxVc2VycywgYWxsT3JkZXJEZXRhaWxzLCBNYW5hZ2VPcmRlcnNGYWN0b3J5KSB7XG5cbiAgICAkc2NvcGUucHJvZHVjdHMgPSBhbGxQcm9kdWN0cztcbiAgICAkc2NvcGUudXNlcnMgPSBhbGxVc2VycztcbiAgICAkc2NvcGUudXNlck9yZGVycyA9IGFsbFVzZXJPcmRlcnM7XG5cbiAgICAvL2FkZGluZyBzdGF0dXMgdG8gZWFjaCBvcmRlckRldGFpbFxuICAgIGFsbE9yZGVyRGV0YWlscy5mb3JFYWNoKGZ1bmN0aW9uKG9yZGVyRGV0YWlsKXtcbiAgICBcdE1hbmFnZU9yZGVyc0ZhY3RvcnkuZmluZFN0YXR1cyhvcmRlckRldGFpbC51c2VyT3JkZXJJZClcbiAgICBcdC50aGVuKGZ1bmN0aW9uKHN0YXR1cyl7XG4gICAgXHRcdG9yZGVyRGV0YWlsLnN0YXR1cyA9IHN0YXR1cztcbiAgICBcdH0pLmNhdGNoKCRsb2cuZXJyb3IpO1xuICAgIH0pXG5cbiAgICAvL2FkZGluZyB1c2VyIGluZm8gdG8gZWFjaCBvcmRlckRldGFpbFxuICAgIGFsbE9yZGVyRGV0YWlscy5mb3JFYWNoKGZ1bmN0aW9uKG9yZGVyRGV0YWlsKXtcbiAgICBcdE1hbmFnZU9yZGVyc0ZhY3RvcnkuZmluZFVzZXIob3JkZXJEZXRhaWwudXNlck9yZGVySWQpXG4gICAgXHQudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICBcdFx0b3JkZXJEZXRhaWwudXNlciA9IHVzZXI7XG4gICAgXHR9KS5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICB9KVxuICAgIGFsbE9yZGVyRGV0YWlscyA9IGFsbE9yZGVyRGV0YWlscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnVzZXJPcmRlcklkIC0gYi51c2VyT3JkZXJJZDtcbiAgICB9KTtcbiAgICBhbGxPcmRlckRldGFpbHMgPSBfLmdyb3VwQnkoYWxsT3JkZXJEZXRhaWxzLCAndXNlck9yZGVySWQnKVxuICAgICRzY29wZS5vcmRlcnMgPSAkLm1hcChhbGxPcmRlckRldGFpbHMsZnVuY3Rpb24gKG9yZGVyLCBpKSB7XG4gICAgICAgIGlmIChpKSByZXR1cm4gW29yZGVyXTtcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCRzY29wZS5vcmRlcnMpO1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXJcbiAgICAuc3RhdGUoJ2FkbWluJywge1xuICAgICAgICB1cmw6ICcvYWRtaW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2FkbWluL2FkbWluLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnQWRtaW5DdHJsJyxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgYWxsUHJvZHVjdHM6IGZ1bmN0aW9uIChQcm9kdWN0RmFjdG9yeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9kdWN0RmFjdG9yeS5mZXRjaEFsbCgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFsbFVzZXJzOiBmdW5jdGlvbiAoVXNlckZhY3RvcnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZmV0Y2hBbGwoKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFsbE9yZGVyRGV0YWlsczogZnVuY3Rpb24oTWFuYWdlT3JkZXJzRmFjdG9yeSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hbmFnZU9yZGVyc0ZhY3RvcnkuZmV0Y2hBbGwoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhbGxVc2VyT3JkZXJzOiBmdW5jdGlvbihNYW5hZ2VPcmRlcnNGYWN0b3J5KXtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWFuYWdlT3JkZXJzRmFjdG9yeS5mZXRjaEFsbFVzZXJPcmRlcnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pXG59KVxuIiwiIGFwcC5jb250cm9sbGVyKCdDYXJ0Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGxvZywgY2FydENvbnRlbnQsIENhcnRGYWN0b3J5KXtcbiBcdCRzY29wZS5jYXJ0Q29udGVudD1jYXJ0Q29udGVudDtcblxuIFx0JHNjb3BlLnJlbW92ZT0gZnVuY3Rpb24ob3JkZXJJZCkge1xuIFx0XHRDYXJ0RmFjdG9yeS5yZW1vdmVGcm9tQ2FydChvcmRlcklkKVxuIFx0XHQudGhlbihmdW5jdGlvbihuZXdDYXJ0KXtcbiBcdFx0XHQkc2NvcGUuY2FydENvbnRlbnQgPSBuZXdDYXJ0O1xuIFx0XHR9KS5jYXRjaCgkbG9nKVxuIFx0fVxuXG4gXHQkc2NvcGUuY2hhbmdlUXVhbnRpdHk9IGZ1bmN0aW9uIChjYXJ0SWQsIHF1YW50aXR5LCBhZGRPclN1YnRyYWN0KSB7XG4gICAgICAgIENhcnRGYWN0b3J5LmNoYW5nZVF1YW50aXR5KGNhcnRJZCwgcXVhbnRpdHksIGFkZE9yU3VidHJhY3QpO1xuICAgICAgICAkc2NvcGUuY2FydENvbnRlbnQgPSBDYXJ0RmFjdG9yeS5jYWNoZWRDYXJ0O1xuICAgIH07XG5cbiAgJHNjb3BlLmNoZWNrb3V0ID0gQ2FydEZhY3RvcnkuY2hlY2tvdXQ7XG5cbiAgJHNjb3BlLnRvdGFsID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRvdGFsID0gMDtcbiAgICBjYXJ0Q29udGVudC5mb3JFYWNoKGNhcnQgPT4gdG90YWwgKz0gKGNhcnQucHJpY2UgKiBjYXJ0LnF1YW50aXR5KSlcblxuICAgIHJldHVybiB0b3RhbDtcbiAgfVxuIH0pXG5cbiIsIiBhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcbiBcdCRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdjYXJ0Jywge1xuIFx0XHR1cmw6Jy9jYXJ0JyxcbiBcdFx0dGVtcGxhdGVVcmw6J2pzL2NhcnQvY2FydC5odG1sJyxcbiBcdFx0Y29udHJvbGxlcjonQ2FydEN0cmwnLFxuIFx0XHRyZXNvbHZlOntcbiBcdFx0XHRjYXJ0Q29udGVudDpmdW5jdGlvbihDYXJ0RmFjdG9yeSl7XG5cbiBcdFx0XHRcdHJldHVybiBDYXJ0RmFjdG9yeS5mZXRjaEFsbEZyb21DYXJ0KCk7XG5cbiBcdFx0XHR9XG4gXHRcdH1cbiBcdH0pXG4gfSlcblxuIiwiYXBwLmNvbnRyb2xsZXIoJ0NoZWNrb3V0Q3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIENhcnRGYWN0b3J5KSB7XG5cbiAgICBDYXJ0RmFjdG9yeS5mZXRjaEFsbEZyb21DYXJ0KClcbiAgICAudGhlbihmdW5jdGlvbiAoaXRlbXMpIHtcbiAgICAgICAgY29uc29sZS5sb2coaXRlbXMpXG4gICAgICAgICRzY29wZS5pdGVtcyA9IGl0ZW1zO1xuXG4gIFx0XHRcdC8vY2FsY3VsYXRpbmcgdG90YWwgcHJpY2UgYW5kIHB1dCB0aGF0IGludG8gJHNjb3BlLnRvdGFsXG4gICAgICAgIHZhciBpdGVtc0FyciA9IGl0ZW1zO1xuICAgICAgICB2YXIgdG90YWxQcmljZUVhY2ggPSBbXTtcbiAgICAgICAgaXRlbXNBcnIuZm9yRWFjaChmdW5jdGlvbihlbGVtZW50KXtcbiAgICAgICAgXHR0b3RhbFByaWNlRWFjaC5wdXNoKGVsZW1lbnQucHJpY2UgKiBlbGVtZW50LnF1YW50aXR5KTtcbiAgICAgICAgfSlcbiAgICAgICAgJHNjb3BlLnRvdGFsID0gdG90YWxQcmljZUVhY2gucmVkdWNlKCAocHJldiwgY3VycikgPT4gcHJldiArIGN1cnIgKTtcbiAgICB9KVxuXG4gICAgJHNjb3BlLmNoZWNrb3V0ID0gQ2FydEZhY3RvcnkuY2hlY2tvdXQ7XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdjaGVja291dCcsIHtcbiAgICAgICAgdXJsOiAnL2NoZWNrb3V0JyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jaGVja291dC9jaGVja291dC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0NoZWNrb3V0Q3RybCdcbiAgICB9KTtcbn0pO1xuIiwiKGZ1bmN0aW9uICgpIHtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgICBpZiAoIXdpbmRvdy5hbmd1bGFyKSB0aHJvdyBuZXcgRXJyb3IoJ0kgY2FuXFwndCBmaW5kIEFuZ3VsYXIhJyk7XG5cbiAgICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ2ZzYVByZUJ1aWx0JywgW10pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ1NvY2tldCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKTtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5pbyh3aW5kb3cubG9jYXRpb24ub3JpZ2luKTtcbiAgICB9KTtcblxuICAgIC8vIEFVVEhfRVZFTlRTIGlzIHVzZWQgdGhyb3VnaG91dCBvdXIgYXBwIHRvXG4gICAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICAgIGFwcC5jb25zdGFudCgnQVVUSF9FVkVOVFMnLCB7XG4gICAgICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgICAgICBsb2dvdXRTdWNjZXNzOiAnYXV0aC1sb2dvdXQtc3VjY2VzcycsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgICAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG5vdEF1dGhvcml6ZWQ6ICdhdXRoLW5vdC1hdXRob3JpemVkJ1xuICAgIH0pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMpIHtcbiAgICAgICAgdmFyIHN0YXR1c0RpY3QgPSB7XG4gICAgICAgICAgICA0MDE6IEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsXG4gICAgICAgICAgICA0MDM6IEFVVEhfRVZFTlRTLm5vdEF1dGhvcml6ZWQsXG4gICAgICAgICAgICA0MTk6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LFxuICAgICAgICAgICAgNDQwOiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2VFcnJvcjogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KHN0YXR1c0RpY3RbcmVzcG9uc2Uuc3RhdHVzXSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgICAgICAgJyRpbmplY3RvcicsXG4gICAgICAgICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRpbmplY3Rvci5nZXQoJ0F1dGhJbnRlcmNlcHRvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIFNlc3Npb24uY3JlYXRlKGRhdGEuaWQsIGRhdGEudXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmlzQWRtaW4gPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIHVzZXIuaXNBZG1pbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9naW4gPSBmdW5jdGlvbiAoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvbG9naW4nLCBjcmVkZW50aWFscylcbiAgICAgICAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHsgbWVzc2FnZTogJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gc2Vzc2lvbklkO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSkoKTtcbiIsImFwcC5jb250cm9sbGVyKCdPcmRlckhpc3Rvcmllc0N0cmwnLCBmdW5jdGlvbiAoJGxvZywgJHNjb3BlLCBPcmRlckhpc3Rvcmllc0ZhY3RvcnkpIHtcblxuICAgIE9yZGVySGlzdG9yaWVzRmFjdG9yeS5mZXRjaEFsbCgpXG4gICAgLnRoZW4oZnVuY3Rpb24gKHVzZXJPcmRlcnNBcnIpIHtcblxuICAgICAgICB1c2VyT3JkZXJzQXJyLnBhaWRJdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGFyciwgaSl7XG4gICAgICAgICAgICBhcnIuZGF0ZSA9IG5ldyBEYXRlKHVzZXJPcmRlcnNBcnIuZGF0ZVtpXSkudG9TdHJpbmcoKTtcbiAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgICRzY29wZS51c2VyT3JkZXJzID0gdXNlck9yZGVyc0Fyci5wYWlkSXRlbXM7XG4gICAgfSlcbiAgICAuY2F0Y2goJGxvZyk7XG4gICAgXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnb3JkZXJIaXN0b3JpZXMnLCB7XG4gICAgICAgIHVybDogJy9oaXN0b3JpZXMnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2hpc3Rvcnkvb3JkZXJIaXN0b3JpZXMuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdPcmRlckhpc3Rvcmllc0N0cmwnXG4gICAgfSk7XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ2FuaW1hdGlvbicsIGZ1bmN0aW9uICgkc3RhdGUpIHtcbiAgICB2YXIgYW5pbWF0aW9uRW5kRXZlbnRzID0gJ3dlYmtpdEFuaW1hdGlvbkVuZCBvYW5pbWF0aW9uZW5kIG1zQW5pbWF0aW9uRW5kIGFuaW1hdGlvbmVuZCc7XG4gICAgdmFyIGNyZWF0ZUNoYXJhY3RlcnMgPSBmdW5jdGlvbiAoKXtcbiAgICAgICAgdmFyIGNoYXJhY3RlcnMgPSB7XG4gICAgICAgICAgICBhc2g6IFtcbiAgICAgICAgICAgICAgICAnYXNoJyxcbiAgICAgICAgICAgICAgICAnYXNoLWdyZWVuLWJhZycsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgb3RoZXJzOiBbXG4gICAgICAgICAgICAgICAgJ2phbWVzJyxcbiAgICAgICAgICAgICAgICAnY2Fzc2lkeScsXG4gICAgICAgICAgICAgICAgJ2plc3NpZSdcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBnZXRZICgpIHtcbiAgICAgICAgICAgIHJldHVybiAoKCBNYXRoLnJhbmRvbSgpICogMyApICsgMjkpLnRvRml4ZWQoMik7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRaICh5KSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMjAgLSB5KSAqIDEwMCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByYW5kb21DaGFyYWN0ZXJzICh3aG8pIHtcbiAgICAgICAgICAgIHJldHVybiBjaGFyYWN0ZXJzW3dob11bIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiBjaGFyYWN0ZXJzW3dob10ubGVuZ3RoICkgXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIG1ha2VDaGFyYWN0ZXIgKHdobykge1xuXG4gICAgICAgICAgICB2YXIgeERlbGF5ID0gKCB3aG8gPT09ICdhc2gnICkgPyA0IDogNC44O1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gJy13ZWJraXQtYW5pbWF0aW9uLWRlbGF5OiAnICsgKCBNYXRoLnJhbmRvbSgpICogMi43ICsgeERlbGF5ICkudG9GaXhlZCgzKSArICdzOyc7XG4gICAgICAgICAgICB2YXIgY2hhcmFjdGVyID0gcmFuZG9tQ2hhcmFjdGVycyggd2hvICk7XG4gICAgICAgICAgICB2YXIgYm90dG9tID0gZ2V0WSgpO1xuICAgICAgICAgICAgdmFyIHkgPSAnYm90dG9tOiAnKyBib3R0b20gKyclOyc7XG4gICAgICAgICAgICB2YXIgeiA9ICd6LWluZGV4OiAnKyBnZXRaKCBib3R0b20gKSArICc7JztcbiAgICAgICAgICAgIHZhciBzdHlsZSA9IFwic3R5bGU9J1wiK2RlbGF5K1wiIFwiK3krXCIgXCIreitcIidcIjtcblxuICAgICAgICAgICAgcmV0dXJuIFwiXCIgK1xuICAgICAgICAgICAgICAgIFwiPGkgY2xhc3M9J1wiICsgY2hhcmFjdGVyICsgXCIgb3BlbmluZy1zY2VuZScgXCIrIHN0eWxlICsgXCI+XCIgK1xuICAgICAgICAgICAgICAgICAgICBcIjxpIGNsYXNzPVwiICsgY2hhcmFjdGVyICsgXCItcmlnaHQgXCIgKyBcInN0eWxlPSdcIisgZGVsYXkgKyBcIic+PC9pPlwiICtcbiAgICAgICAgICAgICAgICBcIjwvaT5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhc2ggPSBNYXRoLmZsb29yKCBNYXRoLnJhbmRvbSgpICogMTYgKSArIDE2O1xuICAgICAgICB2YXIgb3RoZXJzID0gTWF0aC5mbG9vciggTWF0aC5yYW5kb20oKSAqIDggKSArIDg7XG5cbiAgICAgICAgdmFyIGhvcmRlID0gJyc7XG5cbiAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYXNoOyBpKysgKSB7XG4gICAgICAgICAgICBob3JkZSArPSBtYWtlQ2hhcmFjdGVyKCAnYXNoJyApO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICggdmFyIGogPSAwOyBqIDwgb3RoZXJzOyBqKysgKSB7XG4gICAgICAgICAgICBob3JkZSArPSBtYWtlQ2hhcmFjdGVyKCAnb3RoZXJzJyApO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2h1bWFucycpLmlubmVySFRNTCA9IGhvcmRlO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZTogJzxkaXYgY2xhc3M9XCJydW5uaW5nLWFuaW1hdGlvblwiPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJzxpIGNsYXNzPVwicGlrYWNodSBvcGVuaW5nLXNjZW5lXCI+JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJzxpIGNsYXNzPVwicGlrYWNodS1yaWdodFwiPjwvaT4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPGRpdiBjbGFzcz1cInF1b3RlIGV4Y2xhbWF0aW9uXCI+PC9kaXY+JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnPC9pPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJzxkaXYgaWQ9XCJodW1hbnNcIj48L2Rpdj4nICtcbiAgICAgICAgICAgICAgICAgICAgJzwvZGl2PicsXG4gICAgICAgIGNvbXBpbGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcHJlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICQoJyNtYWluJykuYWRkQ2xhc3MoJ2hlcmUnKVxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVDaGFyYWN0ZXJzKCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwb3N0OiBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJCgnLm9wZW5pbmctc2NlbmUnKS5hZGRDbGFzcygnbW92ZScpXG4gICAgICAgICAgICAgICAgICAgICQoJy5tb3ZlJykub24oYW5pbWF0aW9uRW5kRXZlbnRzLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdzdG9yZScpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlOiBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgfVxuICAgIH1cbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9ob21lL2hvbWUuaHRtbCdcbiAgICB9KTtcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcbiAgICAgICAgdXJsOiAnL2xvZ2luJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9sb2dpbi5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KTtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdyZXNldCcsIHtcbiAgICAgICAgdXJsOiAnL3Jlc2V0JyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9yZXNldC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KVxuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3Bhc3N3b3JkJywge1xuICAgICAgICB1cmw6ICcvcmVzZXQvcGFzc3dvcmQvOnRva2VuJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9wYXNzd29yZC5yZXNldC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KVxuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsIEF1dGhGYWN0b3J5LCAkc3RhdGVQYXJhbXMsIENhcnRGYWN0b3J5KSB7XG5cbiAgICAkc2NvcGUubG9naW4gPSB7fTtcbiAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuICAgICRzY29wZS50b2tlbiA9ICRzdGF0ZVBhcmFtcy50b2tlbjtcblxuICAgICRzY29wZS5mb3JnZXRQYXNzd29yZCA9IGZ1bmN0aW9uIChlbWFpbCkge1xuICAgICAgICBBdXRoRmFjdG9yeS5mb3JnZXRQYXNzd29yZChlbWFpbCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnQ2hlY2sgeW91ciBlbWFpbCcsIDEwMDApO1xuICAgICAgICB9KVxuICAgIH07XG4gICAgJHNjb3BlLnJlc2V0UGFzc3dvcmQgPSBmdW5jdGlvbiAodG9rZW4sIHBhc3N3b3JkKSB7XG4gICAgICAgIEF1dGhGYWN0b3J5LnJlc2V0UGFzc3dvcmQocGFzc3dvcmQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ3N0b3JlJyk7XG4gICAgICAgIH0pXG4gICAgfTtcblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIENhcnRGYWN0b3J5LmZldGNoQWxsRnJvbUNhcnQoKVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChjYXJ0KSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ3N0b3JlJyk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLic7XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxufSk7XG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWVtYmVyc09ubHknLCB7XG4gICAgICAgIHVybDogJy9tZW1iZXJzLWFyZWEnLFxuICAgICAgICB0ZW1wbGF0ZTogJzxpbWcgbmctcmVwZWF0PVwiaXRlbSBpbiBzdGFzaFwiIHdpZHRoPVwiMzAwXCIgbmctc3JjPVwie3sgaXRlbSB9fVwiIC8+JyxcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzY29wZSwgU2VjcmV0U3Rhc2gpIHtcbiAgICAgICAgICAgIFNlY3JldFN0YXNoLmdldFN0YXNoKCkudGhlbihmdW5jdGlvbiAoc3Rhc2gpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc3Rhc2ggPSBzdGFzaDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGRhdGEuYXV0aGVudGljYXRlIGlzIHJlYWQgYnkgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgLy8gdGhhdCBjb250cm9scyBhY2Nlc3MgdG8gdGhpcyBzdGF0ZS4gUmVmZXIgdG8gYXBwLmpzLlxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG59KTtcblxuYXBwLmZhY3RvcnkoJ1NlY3JldFN0YXNoJywgZnVuY3Rpb24gKCRodHRwKSB7XG5cbiAgICB2YXIgZ2V0U3Rhc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVtYmVycy9zZWNyZXQtc3Rhc2gnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZXRTdGFzaDogZ2V0U3Rhc2hcbiAgICB9O1xuXG59KTsiLCJhcHAuY29udHJvbGxlcignUGF5bWVudEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsVXNlckZhY3RvcnksICRsb2csIENhcnRGYWN0b3J5LCB0b3RhbENvc3QsIGFycmF5T2ZJdGVtcyl7XG4gICRzY29wZS5pbmZvID0ge307XG4gIFxuICAkc2NvcGUudmFsaWRhdGVVc2VyPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgVXNlckZhY3RvcnkudXBkYXRlVXNlckJlZm9yZVBheW1lbnQoJHNjb3BlLmluZm8pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICRzY29wZS5zaG93Q0MgPSB0cnVlO1xuICAgICAgICB9KS5jYXRjaCgkbG9nLmVycm9yKVxuICAgICAgICBcbiAgfVxuICAkc2NvcGUudG90YWxDb3N0ID0gdG90YWxDb3N0O1xuICAkc2NvcGUuYXJyYXlPZkl0ZW1zID0gYXJyYXlPZkl0ZW1zO1xuICAkc2NvcGUuc3RyaW5nT2ZJdGVtcyA9IGFycmF5T2ZJdGVtcy5tYXAoaXRlbSA9PiBpdGVtLnRpdGxlKS5qb2luKCcsJylcbn0pIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncGF5bWVudCcsIHtcbiAgICAgICAgdXJsOiAnL3BheW1lbnQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3BheW1lbnQvcGF5bWVudC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjonUGF5bWVudEN0cmwnLFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgICAgdG90YWxDb3N0OiBmdW5jdGlvbihDYXJ0RmFjdG9yeSkgeyByZXR1cm4gQ2FydEZhY3RvcnkuZ2V0VG90YWxDb3N0KCkgfSxcbiAgICAgICAgICBhcnJheU9mSXRlbXM6IGZ1bmN0aW9uKENhcnRGYWN0b3J5KSB7IHJldHVybiBDYXJ0RmFjdG9yeS5mZXRjaEFsbEZyb21DYXJ0KCkgfVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcbiAiLCJhcHAuY29udHJvbGxlcignUHJvZHVjdEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCB0aGVQcm9kdWN0LCBhbGxSZXZpZXdzLCBQcm9kdWN0RmFjdG9yeSwgQ2FydEZhY3RvcnkpIHtcbiAgICAvLyBwcm9kdWN0XG4gICAgJHNjb3BlLm5ld1JldmlldyA9IHt9O1xuICAgICRzY29wZS5wcm9kdWN0ID0gdGhlUHJvZHVjdDtcbiAgICAkc2NvcGUucmV2aWV3cyA9IGFsbFJldmlld3M7XG4gICAgLy8gcmV2aWV3XG4gICAgJHNjb3BlLm1vZGFsT3BlbiA9IGZhbHNlO1xuICAgICRzY29wZS5zdWJtaXRSZXZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICRzY29wZS5uZXdSZXZpZXcucHJvZHVjdElkID0gJHNjb3BlLnByb2R1Y3QuaWQ7XG4gICAgICAgIFByb2R1Y3RGYWN0b3J5LmNyZWF0ZVJldmlldygkc2NvcGUucHJvZHVjdC5pZCwgJHNjb3BlLm5ld1JldmlldykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUucmV2aWV3cyA9IFByb2R1Y3RGYWN0b3J5LmNhY2hlZFJldmlld3M7XG4gICAgICAgICAgICAkc2NvcGUubmV3UmV2aWV3ID0ge307XG4gICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnVGhhbmsgeW91IScsIDEwMDApO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnU29tZXRoaW5nIHdlbnQgd3JvbmcnLCAxMDAwKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGFkZCB0byBjYXJ0XG4gICAgJHNjb3BlLmFkZFRvQ2FydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgQ2FydEZhY3RvcnkuYWRkVG9DYXJ0KCRzY29wZS5wcm9kdWN0LmlkLCAkc2NvcGUucXVhbnRpdHkpXG4gICAgfTtcbiAgICAkc2NvcGUuYXJyYXlNYWtlciA9IGZ1bmN0aW9uIChudW0pe1xuICAgICAgICB2YXIgYXJyID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDw9bnVtOyBpICsrKXtcbiAgICAgICAgICAgIGFyci5wdXNoKGkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG59KVxuXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdwcm9kdWN0Jywge1xuICAgICAgICBhdXRvc2Nyb2xsOiAndHJ1ZScsXG4gICAgICAgIHVybDogJy9wcm9kdWN0cy86cHJvZHVjdElkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9wcm9kdWN0L3Byb2R1Y3QuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdQcm9kdWN0Q3RybCcsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgIHRoZVByb2R1Y3Q6IGZ1bmN0aW9uIChQcm9kdWN0RmFjdG9yeSwgJHN0YXRlUGFyYW1zKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb2R1Y3RGYWN0b3J5LmZldGNoQnlJZCgkc3RhdGVQYXJhbXMucHJvZHVjdElkKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhbGxSZXZpZXdzOiBmdW5jdGlvbihQcm9kdWN0RmFjdG9yeSwgJHN0YXRlUGFyYW1zKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb2R1Y3RGYWN0b3J5LmZldGNoQWxsUmV2aWV3cygkc3RhdGVQYXJhbXMucHJvZHVjdElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3NpZ251cCcsIHtcbiAgICAgICAgdXJsOiAnL3NpZ251cCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2lnbnVwL3NpZ251cC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ1NpZ251cEN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignU2lnbnVwQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhGYWN0b3J5LCAkc3RhdGUpIHtcbiAgICAkc2NvcGUuc2lnbnVwID0ge307XG4gICAgJHNjb3BlLnNlbmRTaWdudXAgPSBmdW5jdGlvbiAoc2lnbnVwSW5mbykge1xuICAgICAgICBBdXRoRmFjdG9yeS5zaWdudXAoc2lnbnVwSW5mbylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgPT09ICdlbWFpbCBleGlzdHMgYWxyZWFkeScpIHtcbiAgICAgICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnVXNlciBhbHJlYWR5IGV4aXN0cycsIDIwMDApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ3N0b3JlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuICAgICRzY29wZS5nb29nbGVTaWdudXAgPSBBdXRoRmFjdG9yeS5nb29nbGVTaWdudXA7XG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdTdG9yZUN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBwcm9kdWN0cykge1xuICAgICRzY29wZS5wcm9kdWN0cyA9IHByb2R1Y3RzO1xufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3N0b3JlJywge1xuICAgICAgICB1cmw6ICcvc3RvcmUnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3N0b3JlL3N0b3JlLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU3RvcmVDdHJsJyxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgcHJvZHVjdHM6IGZ1bmN0aW9uIChQcm9kdWN0RmFjdG9yeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9kdWN0RmFjdG9yeS5mZXRjaEFsbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcbiIsImFwcC5mYWN0b3J5KCdGdWxsc3RhY2tQaWNzJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBbXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjdnQlh1bENBQUFYUWNFLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL2ZiY2RuLXNwaG90b3MtYy1hLmFrYW1haWhkLm5ldC9ocGhvdG9zLWFrLXhhcDEvdDMxLjAtOC8xMDg2MjQ1MV8xMDIwNTYyMjk5MDM1OTI0MV84MDI3MTY4ODQzMzEyODQxMTM3X28uanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLUxLVXNoSWdBRXk5U0suanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNzktWDdvQ01BQWt3N3kuanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLVVqOUNPSUlBSUZBaDAuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNnlJeUZpQ0VBQXFsMTIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRS1UNzVsV0FBQW1xcUouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRXZaQWctVkFBQWs5MzIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRWdOTWVPWElBSWZEaEsuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRVF5SUROV2dBQXU2MEIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQ0YzVDVRVzhBRTJsR0ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWVWdzVTV29BQUFMc2ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWFKSVA3VWtBQWxJR3MuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQVFPdzlsV0VBQVk5RmwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLU9RYlZyQ01BQU53SU0uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9COWJfZXJ3Q1lBQXdSY0oucG5nOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNVBUZHZuQ2NBRUFsNHguanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNHF3QzBpQ1lBQWxQR2guanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CMmIzM3ZSSVVBQTlvMUQuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cd3BJd3IxSVVBQXZPMl8uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cc1NzZUFOQ1lBRU9oTHcuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSjR2TGZ1VXdBQWRhNEwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSTd3empFVkVBQU9QcFMuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSWRIdlQyVXNBQW5uSFYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DR0NpUF9ZV1lBQW83NVYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSVM0SlBJV0lBSTM3cXUuanBnOmxhcmdlJ1xuICAgIF07XG59KTtcbiIsImFwcC5mYWN0b3J5KCdPcmRlckhpc3Rvcmllc0ZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHApIHtcblxuICAgIHZhciBjYWNoZWRDYXJ0ID0gW107XG4gICAgdmFyIGJhc2VVcmwgPSAnL2FwaS9vcmRlcnMvcGFpZC8nXG4gICAgdmFyIG9yZGVySGlzdG9yaWVzRmFjdG9yeSA9IHt9O1xuICAgIHZhciBnZXREYXRhID0gcmVzID0+IHJlcy5kYXRhO1xuXG4gICAgb3JkZXJIaXN0b3JpZXNGYWN0b3J5LmZldGNoQWxsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmNvcHkocmVzcG9uc2UuZGF0YSwgY2FjaGVkQ2FydClcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2FydDtcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gXG5cbiAgICByZXR1cm4gb3JkZXJIaXN0b3JpZXNGYWN0b3J5O1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdSYW5kb21HcmVldGluZ3MnLCBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgZ2V0UmFuZG9tRnJvbUFycmF5ID0gZnVuY3Rpb24gKGFycikge1xuICAgICAgICByZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcbiAgICB9O1xuXG4gICAgdmFyIGdyZWV0aW5ncyA9IFtcbiAgICAgICAgJ0hlbGxvLCB3b3JsZCEnLFxuICAgICAgICAnQXQgbG9uZyBsYXN0LCBJIGxpdmUhJyxcbiAgICAgICAgJ0hlbGxvLCBzaW1wbGUgaHVtYW4uJyxcbiAgICAgICAgJ1doYXQgYSBiZWF1dGlmdWwgZGF5IScsXG4gICAgICAgICdJXFwnbSBsaWtlIGFueSBvdGhlciBwcm9qZWN0LCBleGNlcHQgdGhhdCBJIGFtIHlvdXJzLiA6KScsXG4gICAgICAgICdUaGlzIGVtcHR5IHN0cmluZyBpcyBmb3IgTGluZHNheSBMZXZpbmUuJyxcbiAgICAgICAgJ+OBk+OCk+OBq+OBoeOBr+OAgeODpuODvOOCtuODvOanmOOAgicsXG4gICAgICAgICdXZWxjb21lLiBUby4gV0VCU0lURS4nLFxuICAgICAgICAnOkQnLFxuICAgICAgICAnWWVzLCBJIHRoaW5rIHdlXFwndmUgbWV0IGJlZm9yZS4nLFxuICAgICAgICAnR2ltbWUgMyBtaW5zLi4uIEkganVzdCBncmFiYmVkIHRoaXMgcmVhbGx5IGRvcGUgZnJpdHRhdGEnLFxuICAgICAgICAnSWYgQ29vcGVyIGNvdWxkIG9mZmVyIG9ubHkgb25lIHBpZWNlIG9mIGFkdmljZSwgaXQgd291bGQgYmUgdG8gbmV2U1FVSVJSRUwhJyxcbiAgICBdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ3JlZXRpbmdzOiBncmVldGluZ3MsXG4gICAgICAgIGdldFJhbmRvbUdyZWV0aW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0UmFuZG9tRnJvbUFycmF5KGdyZWV0aW5ncyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdBdXRoRmFjdG9yeScsICBmdW5jdGlvbigkaHR0cCl7XG5cbiAgICB2YXIgZ2V0RGF0YSA9IHJlcyA9PiByZXMuZGF0YTtcblxuICAgIHZhciBBdXRoRmFjdG9yeSA9IHt9O1xuXG5cbiAgICBBdXRoRmFjdG9yeS5zaWdudXAgPSBmdW5jdGlvbiAoc2lnbnVwSW5mbykge1xuICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL3NpZ251cCcsIHNpZ251cEluZm8pLnRoZW4oZ2V0RGF0YSlcbiAgICB9XG5cbiAgICBBdXRoRmFjdG9yeS5nb29nbGVTaWdudXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hdXRoL2dvb2dsZScpO1xuICAgIH1cblxuICAgIEF1dGhGYWN0b3J5LnJlc2V0UGFzc3dvcmQgPSBmdW5jdGlvbiAodG9rZW4sIGxvZ2luKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvcmVzZXQvcGFzc3dvcmQvJyArIHRva2VuLCBsb2dpbik7XG4gICAgfVxuXG4gICAgQXV0aEZhY3RvcnkuZm9yZ2V0UGFzc3dvcmQgPSBmdW5jdGlvbiAoZW1haWwpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9mb3Jnb3QnLCBlbWFpbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEF1dGhGYWN0b3J5O1xufSk7XG4iLCJhcHAuZmFjdG9yeSgnQ2FydEZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHAsICRsb2csICRzdGF0ZSwgJHJvb3RTY29wZSkge1xuXG4gICAgdmFyIGdldERhdGEgPSByZXMgPT4gcmVzLmRhdGE7XG4gICAgdmFyIGJhc2VVcmwgPSAnL2FwaS9vcmRlcnMvY2FydC8nO1xuICAgIHZhciBjb252ZXJ0ID0gZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgaXRlbS5pbWFnZVVybCA9ICcvYXBpL3Byb2R1Y3RzLycgKyBpdGVtLnByb2R1Y3RJZCArICcvaW1hZ2UnO1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG4gICAgdmFyIENhcnRGYWN0b3J5ID0ge307XG4gICAgQ2FydEZhY3RvcnkuY2FjaGVkQ2FydCA9IFtdO1xuXG4gICAgQ2FydEZhY3RvcnkuZmV0Y2hBbGxGcm9tQ2FydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChiYXNlVXJsKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIGFuZ3VsYXIuY29weShyZXNwb25zZS5kYXRhLCBDYXJ0RmFjdG9yeS5jYWNoZWRDYXJ0KVxuICAgICAgICAgICAgcmV0dXJuIENhcnRGYWN0b3J5LmNhY2hlZENhcnQuc29ydChmdW5jdGlvbiAoYSxiKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5pZCAtIGEuaWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoaXRlbXMpIHtcbiAgICAgICAgICAgIENhcnRGYWN0b3J5LmNhY2hlZENhcnQgPSBpdGVtcy5tYXAoY29udmVydCk7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRlbWl0KCd1cGRhdGVDYXJ0JywgQ2FydEZhY3RvcnkuY2FjaGVkQ2FydCk7XG4gICAgICAgICAgICByZXR1cm4gaXRlbXMubWFwKGNvbnZlcnQpO1xuICAgICAgICB9KVxuICAgIH1cblxuICAgIENhcnRGYWN0b3J5LmRlbGV0ZUl0ZW0gPSBmdW5jdGlvbihwcm9kdWN0SWQpe1xuICAgICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKGJhc2VVcmwgKyBwcm9kdWN0SWQpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICAgICAgICAgIGFuZ3VsYXIuY29weShyZXNwb25zZS5kYXRhLCBDYXJ0RmFjdG9yeS5jYWNoZWRDYXJ0KVxuICAgICAgICAgICAgcmV0dXJuIENhcnRGYWN0b3J5LmNhY2hlZENhcnQ7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgQ2FydEZhY3RvcnkuY2hlY2tGb3JEdXBsaWNhdGVzID0gZnVuY3Rpb24ocHJvZHVjdElkKXtcbiAgICAgICAgdmFyIGR1cGxpY2F0ZSA9IHRoaXMuY2FjaGVkQ2FydC5maWx0ZXIoaXRlbSA9PiBpdGVtLnByb2R1Y3RJZCA9PT0gcHJvZHVjdElkKTtcbiAgICAgICAgcmV0dXJuIChkdXBsaWNhdGUubGVuZ3RoKSA/IGR1cGxpY2F0ZVswXSA6IG51bGw7XG4gICAgfVxuXG4gICAgQ2FydEZhY3RvcnkuYWRkVG9DYXJ0ID0gZnVuY3Rpb24gKHByb2R1Y3RJZCwgcXVhbnRpdHkpIHtcbiAgICAgICAgdmFyIGR1cGxpY2F0ZSA9IENhcnRGYWN0b3J5LmNoZWNrRm9yRHVwbGljYXRlcyhwcm9kdWN0SWQpO1xuICAgICAgICBpZiAoZHVwbGljYXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gQ2FydEZhY3RvcnlcbiAgICAgICAgICAgIC5jaGFuZ2VRdWFudGl0eShkdXBsaWNhdGUuaWQsIGR1cGxpY2F0ZS5xdWFudGl0eSwgJ2FkZCcsIHF1YW50aXR5ICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhZGRTdWNjZXNzQW5pbWF0aW9uKClcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwgKyBwcm9kdWN0SWQsIHtxdWFudGl0eTogcXVhbnRpdHl9KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGl0ZW0gPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIENhcnRGYWN0b3J5LmNhY2hlZENhcnQucHVzaChpdGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvLyAudGhlbihjb252ZXJ0KVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgQ2FydEZhY3RvcnkucmVtb3ZlRnJvbUNhcnQ9ZnVuY3Rpb24ob3JkZXJJZCl7XG4gICAgICAgIGFkZFJlbW92ZUFuaW1hdGlvbigpO1xuICAgICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKGJhc2VVcmwrb3JkZXJJZClcbiAgICAgICAgLnN1Y2Nlc3MoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIENhcnRGYWN0b3J5LnJlbW92ZUZyb21Gcm9udEVuZENhY2hlKG9yZGVySWQpXG4gICAgICAgICB9KVxuICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBDYXJ0RmFjdG9yeS5jYWNoZWRDYXJ0O1xuICAgICAgICB9KVxuICAgIH1cbiAgICBDYXJ0RmFjdG9yeS5jaGFuZ2VRdWFudGl0eT1mdW5jdGlvbihvcmRlcklkLCBxdWFudGl0eSwgYWRkT3JTdWJ0ciwgYW1vdW50ID0gMSl7XG4gICAgICAgIHZhciBydW5GdW5jPWZhbHNlO1xuICAgICAgICBpZiAoYWRkT3JTdWJ0cj09PSdhZGQnKSB7XG4gICAgICAgICAgICBhZGRTdWNjZXNzQW5pbWF0aW9uKClcbiAgICAgICAgICAgIHF1YW50aXR5Kz0gK2Ftb3VudDtcbiAgICAgICAgICAgIHJ1bkZ1bmM9dHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChhZGRPclN1YnRyPT09J3N1YnRyYWN0JyAmJiBxdWFudGl0eT4xKSB7XG4gICAgICAgICAgICBhZGRSZW1vdmVBbmltYXRpb24oKTtcbiAgICAgICAgICAgIHF1YW50aXR5LT0gK2Ftb3VudDtcbiAgICAgICAgICAgIHJ1bkZ1bmM9dHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocnVuRnVuYz09PXRydWUpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wdXQoYmFzZVVybCArIG9yZGVySWQsIHtxdWFudGl0eTpxdWFudGl0eX0pXG4gICAgICAgICAgICAvLyAudGhlbihjb252ZXJ0KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBDYXJ0RmFjdG9yeS5jaGFuZ2VGcm9udEVuZENhY2hlUXVhbnRpdHkob3JkZXJJZCxxdWFudGl0eSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cblxuICAgIH1cblxuICAgIENhcnRGYWN0b3J5LnJlbW92ZUZyb21Gcm9udEVuZENhY2hlID0gZnVuY3Rpb24ob3JkZXJJZCl7XG4gICAgICAgIHZhciBpbmRleDtcbiAgICAgICAgQ2FydEZhY3RvcnkuY2FjaGVkQ2FydC5mb3JFYWNoKGZ1bmN0aW9uKG9yZGVyLGkpe1xuICAgICAgICAgICAgaWYgKG9yZGVyLmlkID09PSBvcmRlcklkKSBpbmRleCA9IGk7XG4gICAgICAgIH0pXG5cbiAgICAgICAgQ2FydEZhY3RvcnkuY2FjaGVkQ2FydC5zcGxpY2UoaW5kZXgsMSk7XG4gICAgfVxuXG4gICAgQ2FydEZhY3RvcnkuY2hhbmdlRnJvbnRFbmRDYWNoZVF1YW50aXR5ID0gZnVuY3Rpb24gKG9yZGVySWQscXVhbnRpdHkpIHtcbiAgICAgICAgdmFyIGkgPSBDYXJ0RmFjdG9yeS5jYWNoZWRDYXJ0LmZpbmRJbmRleChmdW5jdGlvbihvcmRlcil7XG4gICAgICAgICAgICAvLyBpZiAob3JkZXIuaWQgPT09IG9yZGVySWQpIHtcbiAgICAgICAgICAgIC8vICAgICBvcmRlci5xdWFudGl0eSA9IHF1YW50aXR5O1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgcmV0dXJuIG9yZGVyLmlkID09PSBvcmRlcklkO1xuICAgICAgICB9KTtcbiAgICAgICAgQ2FydEZhY3RvcnkuY2FjaGVkQ2FydFtpXS5xdWFudGl0eSA9IHF1YW50aXR5XG4gICAgfVxuXG4gICAgQ2FydEZhY3RvcnkuY2hlY2tvdXQgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwgKyAnY2hlY2tvdXQnKVxuICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygnb3JkZXJIaXN0b3JpZXMnKTtcbiAgICAgICAgICAgIENhcnRGYWN0b3J5LmNhY2hlZENhcnQuc3BsaWNlKDAsIENhcnRGYWN0b3J5LmNhY2hlZENhcnQubGVuZ3RoKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIE1hdGVyaWFsaXplLnRvYXN0KCdPb3BzLCBTb21ldGhpbmcgd2VudCB3cm9uZycsIDEwMDApO1xuICAgICAgICB9KVxuICAgIH1cblxuICAgIENhcnRGYWN0b3J5LmdldFRvdGFsQ29zdCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciB0b3RhbCA9IDA7XG4gICAgICAgICByZXR1cm4gQ2FydEZhY3RvcnkuZmV0Y2hBbGxGcm9tQ2FydCgpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihjYXJ0KXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjYXJ0KVxuICAgICAgICAgICAgICAgIGNhcnQuZm9yRWFjaChpdGVtID0+IHRvdGFsICs9IChpdGVtLnByaWNlKml0ZW0ucXVhbnRpdHkpIClcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndG90YScsIHRvdGFsKVxuICAgICAgICAgICAgICAgIHJldHVybiB0b3RhbDtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goJGxvZy5lcnJvcilcbiAgICB9XG5cblxuICAgIHZhciBhbmltYXRpb25FbmQgPSAnd2Via2l0QW5pbWF0aW9uRW5kIG1vekFuaW1hdGlvbkVuZCBNU0FuaW1hdGlvbkVuZCBvYW5pbWF0aW9uZW5kIGFuaW1hdGlvbmVuZCc7XG5cbiAgICBmdW5jdGlvbiBhZGRTdWNjZXNzQW5pbWF0aW9uKCkge1xuICAgICAgICAkKCcjY2FydC1pY29uJykuYWRkQ2xhc3MoJ2FuaW1hdGVkIHJ1YmJlckJhbmQnKS5vbmUoYW5pbWF0aW9uRW5kLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkKCcjY2FydC1pY29uJykucmVtb3ZlQ2xhc3MoJ2FuaW1hdGVkIHJ1YmJlckJhbmQnKTtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRSZW1vdmVBbmltYXRpb24oKSB7XG4gICAgICAgICQoJyNjYXJ0LWljb24nKS5hZGRDbGFzcygnYW5pbWF0ZWQgc2hha2UnKS5vbmUoYW5pbWF0aW9uRW5kLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkKCcjY2FydC1pY29uJykucmVtb3ZlQ2xhc3MoJ2FuaW1hdGVkIHNoYWtlJyk7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIENhcnRGYWN0b3J5O1xuXG59KTtcbiIsImFwcC5mYWN0b3J5KCdNYW5hZ2VPcmRlcnNGYWN0b3J5JywgZnVuY3Rpb24gKCRodHRwKSB7XG5cbiAgICB2YXIgY2FjaGVkT3JkZXJEZXRhaWxzID0gW107XG4gICAgdmFyIGNhY2hlZFVzZXJPcmRlcnMgPSBbXTtcbiAgICB2YXIgYmFzZVVybCA9ICcvYXBpL21hbmFnZU9yZGVycy8nXG4gICAgdmFyIG1hbmFnZU9yZGVyc0ZhY3RvcnkgPSB7fTtcbiAgICB2YXIgZ2V0RGF0YSA9IHJlcyA9PiByZXMuZGF0YTtcblxuICAgIG1hbmFnZU9yZGVyc0ZhY3RvcnkuZmV0Y2hBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoYmFzZVVybClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBhbmd1bGFyLmNvcHkocmVzcG9uc2UuZGF0YSwgY2FjaGVkT3JkZXJEZXRhaWxzKVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZE9yZGVyRGV0YWlscztcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBtYW5hZ2VPcmRlcnNGYWN0b3J5LmZldGNoQWxsVXNlck9yZGVycyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCsgJ3VzZXJPcmRlcicpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICAgICAgICAgIGFuZ3VsYXIuY29weShyZXNwb25zZS5kYXRhLCBjYWNoZWRVc2VyT3JkZXJzKVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFVzZXJPcmRlcnM7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgbWFuYWdlT3JkZXJzRmFjdG9yeS5maW5kU3RhdHVzID0gZnVuY3Rpb24odXNlck9yZGVySWQpe1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KGJhc2VVcmwrICd1c2VyT3JkZXIvJysgdXNlck9yZGVySWQpXG4gICAgICAgIC50aGVuKGdldERhdGEpXG4gICAgfVxuXG4gICAgbWFuYWdlT3JkZXJzRmFjdG9yeS5maW5kVXNlciA9IGZ1bmN0aW9uKHVzZXJPcmRlcklkKXtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChiYXNlVXJsKyAndXNlci8nICsgdXNlck9yZGVySWQpXG4gICAgICAgIC50aGVuKGdldERhdGEpXG4gICAgfVxuXG4gICAgbWFuYWdlT3JkZXJzRmFjdG9yeS51cGRhdGVTdGF0dXMgPSBmdW5jdGlvbih1c2VyT3JkZXJJZCwgZGF0YSl7XG4gICAgICAgIHJldHVybiAkaHR0cC5wdXQoYmFzZVVybCsgJ3VzZXJPcmRlci8nKyB1c2VyT3JkZXJJZCwgZGF0YSlcbiAgICAgICAgLnRoZW4oZ2V0RGF0YSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlck9yZGVyKXtcbiAgICAgICAgICAgIE1hdGVyaWFsaXplLnRvYXN0KFwiVXBkYXRlZFwiLCAxMDAwKTtcbiAgICAgICAgICAgIHZhciB1cGRhdGVkSW5kID0gY2FjaGVkVXNlck9yZGVycy5maW5kSW5kZXgoZnVuY3Rpb24gKHVzZXJPcmRlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVzZXJPcmRlci5pZCA9PT0gdXNlck9yZGVySWQ7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjYWNoZWRVc2VyT3JkZXJzW3VwZGF0ZWRJbmRdID0gdXNlck9yZGVyO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdXNlck9yZGVyO1xuICAgICAgICB9KVxuICAgIH1cbiAgICBtYW5hZ2VPcmRlcnNGYWN0b3J5LmRlbGV0ZVVzZXJPcmRlciA9IGZ1bmN0aW9uICh1c2VyT3JkZXJJZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKGJhc2VVcmwrICd1c2VyT3JkZXIvJysgdXNlck9yZGVySWQpXG4gICAgICAgIC5zdWNjZXNzKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgTWF0ZXJpYWxpemUudG9hc3QoXCJEZWxldGVkXCIsIDEwMDApO1xuICAgICAgICAgICAgdmFyIGRlbGV0ZWRJbmQgPSBjYWNoZWRVc2VyT3JkZXJzLmZpbmRJbmRleChmdW5jdGlvbiAodXNlck9yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVzZXJPcmRlci5pZCA9PT0gdXNlck9yZGVySWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNhY2hlZFVzZXJPcmRlcnMuc3BsaWNlKGRlbGV0ZWRJbmQsIDEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFuYWdlT3JkZXJzRmFjdG9yeTtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnUHJvZHVjdEZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHApIHtcblxuXG4gICAgdmFyIGJhc2VVcmwgPSAnL2FwaS9wcm9kdWN0cy8nO1xuICAgIHZhciBnZXREYXRhID0gcmVzID0+IHJlcy5kYXRhO1xuICAgIHZhciBwYXJzZVRpbWVTdHIgPSBmdW5jdGlvbiAocmV2aWV3KSB7XG4gICAgICAgIHZhciBkYXRlID0gcmV2aWV3LmNyZWF0ZWRBdC5zdWJzdHIoMCwgMTApO1xuICAgICAgICByZXZpZXcuZGF0ZSA9IGRhdGU7XG4gICAgICAgIHJldHVybiByZXZpZXc7XG4gICAgfVxuXG4gICAgdmFyIFByb2R1Y3RGYWN0b3J5ID0ge307XG4gICAgUHJvZHVjdEZhY3RvcnkuY2FjaGVkUHJvZHVjdHMgPSBbXTtcbiAgICBQcm9kdWN0RmFjdG9yeS5jYWNoZWRSZXZpZXdzID0gW107XG5cbiAgICBQcm9kdWN0RmFjdG9yeS5mZXRjaEFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChiYXNlVXJsKS50aGVuKGdldERhdGEpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHByb2R1Y3RzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9kdWN0cy5tYXAoUHJvZHVjdEZhY3RvcnkuY29udmVydCk7XG4gICAgICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbiAocHJvZHVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5jb3B5KHByb2R1Y3RzLCBQcm9kdWN0RmFjdG9yeS5jYWNoZWRQcm9kdWN0cyk7IC8vIHdoeSBhbmd1bGFyIGNvcHkgYWx0ZXJzIGFycmF5IG9yZGVyISEhISEhIVxuICAgICAgICAgICAgICAgICAgICBQcm9kdWN0RmFjdG9yeS5jYWNoZWRQcm9kdWN0cy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYS5pZCAtIGIuaWQ7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9kdWN0RmFjdG9yeS5jYWNoZWRQcm9kdWN0cztcbiAgICAgICAgICAgICAgICB9KVxuICAgIH07XG5cbiAgICBQcm9kdWN0RmFjdG9yeS51cGRhdGVQcm9kdWN0ID0gZnVuY3Rpb24gKGlkLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5wdXQoYmFzZVVybCArIGlkLCBkYXRhKVxuICAgICAgICAgICAgICAgIC50aGVuKGdldERhdGEpXG4gICAgICAgICAgICAgICAgLnRoZW4oUHJvZHVjdEZhY3RvcnkuY29udmVydClcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocHJvZHVjdCkge1xuICAgICAgICAgICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnVXBkYXRlZCcsIDEwMDApO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXBkYXRlZEluZCA9IFByb2R1Y3RGYWN0b3J5LmNhY2hlZFByb2R1Y3RzLmZpbmRJbmRleChmdW5jdGlvbiAocHJvZHVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb2R1Y3QuaWQgPT09IGlkO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgUHJvZHVjdEZhY3RvcnkuY2FjaGVkUHJvZHVjdHNbdXBkYXRlZEluZF0gPSBwcm9kdWN0O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvZHVjdDtcbiAgICAgICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIFByb2R1Y3RGYWN0b3J5LmRlbGV0ZVByb2R1Y3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmRlbGV0ZShiYXNlVXJsICsgaWQpLnN1Y2Nlc3MoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnRGVsZXRlZCcsIDEwMDApO1xuICAgICAgICAgICAgdmFyIGRlbGV0ZWRJbmQgPSBQcm9kdWN0RmFjdG9yeS5jYWNoZWRQcm9kdWN0cy5maW5kSW5kZXgoZnVuY3Rpb24gKHByb2R1Y3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvZHVjdC5pZCA9PT0gaWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFByb2R1Y3RGYWN0b3J5LmNhY2hlZFByb2R1Y3RzLnNwbGljZShkZWxldGVkSW5kLCAxKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgUHJvZHVjdEZhY3RvcnkuZmV0Y2hCeUlkID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCArIGlkKVxuICAgICAgICAgICAgICAgIC50aGVuKGdldERhdGEpXG4gICAgICAgICAgICAgICAgLnRoZW4oUHJvZHVjdEZhY3RvcnkuY29udmVydCk7XG5cbiAgICB9O1xuXG4gICAgUHJvZHVjdEZhY3RvcnkuY29udmVydCA9IGZ1bmN0aW9uIChwcm9kdWN0KSB7XG4gICAgICAgIHByb2R1Y3QuaW1hZ2VVcmwgPSBiYXNlVXJsICsgcHJvZHVjdC5pZCArICcvaW1hZ2UnO1xuICAgICAgICByZXR1cm4gcHJvZHVjdDtcbiAgICB9O1xuXG4gICAgUHJvZHVjdEZhY3RvcnkuY3JlYXRlUmV2aWV3ID0gZnVuY3Rpb24gKHByb2R1Y3RJZCwgZGF0YSkge1xuICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9yZXZpZXdzLycgKyBwcm9kdWN0SWQsIGRhdGEpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2aWV3ID0gcGFyc2VUaW1lU3RyKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICAgIFByb2R1Y3RGYWN0b3J5LmNhY2hlZFJldmlld3MucHVzaChyZXZpZXcpO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXZpZXc7XG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIFByb2R1Y3RGYWN0b3J5LmZldGNoQWxsUmV2aWV3cyA9IGZ1bmN0aW9uIChwcm9kdWN0SWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9yZXZpZXdzLycgKyBwcm9kdWN0SWQpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmNvcHkocmVzcG9uc2UuZGF0YSwgUHJvZHVjdEZhY3RvcnkuY2FjaGVkUmV2aWV3cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb2R1Y3RGYWN0b3J5LmNhY2hlZFJldmlld3MubWFwKHBhcnNlVGltZVN0cik7XG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiBQcm9kdWN0RmFjdG9yeTtcblxufSlcbiIsImFwcC5mYWN0b3J5KCdVc2VyRmFjdG9yeScsIGZ1bmN0aW9uICgkaHR0cCkge1xuICAgIHZhciBVc2VyRmFjdG9yeSA9IHt9O1xuXG4gICAgdmFyIGNhY2hlZFVzZXJzID0gW107XG4gICAgdmFyIGJhc2VVcmwgPSAnL2FwaS91c2Vycy8nO1xuICAgIHZhciBnZXREYXRhID0gcmVzID0+IHJlcy5kYXRhO1xuXG4gICAgVXNlckZhY3RvcnkuZmV0Y2hBbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoYmFzZVVybCkudGhlbihnZXREYXRhKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uICh1c2Vycykge1xuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmNvcHkodXNlcnMsIGNhY2hlZFVzZXJzKTsgLy8gd2h5IGFuZ3VsYXIgY29weSBhbHRlcnMgYXJyYXkgb3JkZXIhISEhISEhXG4gICAgICAgICAgICAgICAgICAgIGNhY2hlZFVzZXJzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhLmlkIC0gYi5pZDtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFVzZXJzO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgfTtcblxuICAgIFVzZXJGYWN0b3J5LnVwZGF0ZVVzZXIgPSBmdW5jdGlvbiAoaWQsIGRhdGEpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLnB1dChiYXNlVXJsICsgaWQsIGRhdGEpXG4gICAgICAgICAgICAgICAgLnRoZW4oZ2V0RGF0YSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXBkYXRlZEluZCA9IGNhY2hlZFVzZXJzLmZpbmRJbmRleChmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVzZXIuaWQgPT09IGlkO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGVkVXNlcnNbdXBkYXRlZEluZF0gPSB1c2VyO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdXNlcjtcbiAgICAgICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LmRlbGV0ZVVzZXIgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmRlbGV0ZShiYXNlVXJsICsgaWQpLnN1Y2Nlc3MoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZGVsZXRlZEluZCA9IGNhY2hlZFVzZXJzLmZpbmRJbmRleChmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1c2VyLmlkID09PSBpZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FjaGVkVXNlcnMuc3BsaWNlKGRlbGV0ZWRJbmQsIDEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBVc2VyRmFjdG9yeS51cGRhdGVVc2VyQmVmb3JlUGF5bWVudCA9IGZ1bmN0aW9uIChpbmZvT2JqKXtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChiYXNlVXJsICsgJ2dldExvZ2dlZEluVXNlcklkJylcbiAgICAgICAgICAgIC50aGVuKGdldERhdGEpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICAgICAgICBpZih1c2VyLmlkID09PSAnc2Vzc2lvbicpe1xuICAgICAgICAgICAgICAgIHJldHVybiAkaHR0cC5wdXQoJ2FwaS9vcmRlcnMvY2FydC91cGRhdGVTZXNzaW9uQ2FydCcsIGluZm9PYmopXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LnVwZGF0ZVVzZXIodXNlci5pZCxpbmZvT2JqKVxuICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJGh0dHAucHV0KCdhcGkvb3JkZXJzL2NhcnQvdXBkYXRlVXNlckNhcnQnLCBpbmZvT2JqKVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIFVzZXJGYWN0b3J5O1xufSlcbiIsImFwcC5kaXJlY3RpdmUoJ3Nob3BwaW5nQ2FydCcsIGZ1bmN0aW9uKENhcnRGYWN0b3J5LCAkcm9vdFNjb3BlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9jYXJ0LXJldmVhbC9jYXJ0LXJldmVhbC5odG1sJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIGFjdGl2ZTogJz0nXG4gICAgICAgIH0sXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbSwgYXR0cikge1xuICAgICAgICAgICAgc2NvcGUuc2hvd0NhcnQgPSAnY2hlY2tvdXQnO1xuICAgICAgICAgICAgQ2FydEZhY3RvcnkuZmV0Y2hBbGxGcm9tQ2FydCgpLnRoZW4oZnVuY3Rpb24gKGNhcnQpIHtcbiAgICAgICAgICAgICAgICBzY29wZS5jYXJ0ID0gQ2FydEZhY3RvcnkuY2FjaGVkQ2FydDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJ3VwZGF0ZUNhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIGNhcnQpIHtcbiAgICAgICAgICAgICAgICBzY29wZS5jYXJ0ID0gY2FydDtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBzY29wZS5yZXZlYWxDYXJ0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLnNob3dDYXJ0ID0gJ2NoZWNrb3V0IGNoZWNrb3V0LS1hY3RpdmUnO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjb3BlLmhpZGVDYXJ0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLmFjdGl2ZSA9ICdpbmFjdGl2ZSc7XG4gICAgICAgICAgICAgICAgc2NvcGUuc2hvd0NhcnQgPSAnY2hlY2tvdXQnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2NvcGUudG90YWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgdG90YWwgPSAwO1xuICAgICAgICAgICAgICAgIGlmKHNjb3BlLmNhcnQpXG4gICAgICAgICAgICAgICAgc2NvcGUuY2FydC5mb3JFYWNoKGl0ZW0gPT4gdG90YWwgKz0gKGl0ZW0ucHJpY2UgKiBpdGVtLnF1YW50aXR5KSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdG90YWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgnZnVsbHN0YWNrTG9nbycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmh0bWwnXG4gICAgfTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnU2hvcCcsIHN0YXRlOiAnc3RvcmUnIH0sXG4gICAgICAgICAgICAgICAgLy8geyBsYWJlbDogJ01lbWJlcnMgT25seScsIHN0YXRlOiAnbWVtYmVyc09ubHknLCBhdXRoOiB0cnVlIH1cbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIHNjb3BlLnRvZ2dsZUxvZ28gPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICQoJy5wb2tlYmFsbCBpLmdyZWF0JykuY3NzKCdiYWNrZ3JvdW5kLXBvc2l0aW9uJywgJy0yOTdweCAtMzA2cHgnKVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLnVudG9nZ2xlTG9nbyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICQoJy5wb2tlYmFsbCBpLmdyZWF0JykuY3NzKCdiYWNrZ3JvdW5kLXBvc2l0aW9uJywgJy0yOTNweCAtOXB4JylcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgICAgICAgIHNjb3BlLmFkbWluID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc2V0VXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc2V0QWRtaW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coQXV0aEludGVyY2VwdG9yKTtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLmFkbWluID0gQXV0aFNlcnZpY2UuaXNBZG1pbih1c2VyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNldFVzZXIoKTtcbiAgICAgICAgICAgIHNldEFkbWluKCk7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcywgc2V0VXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCByZW1vdmVVc2VyKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYXBwLmRpcmVjdGl2ZSgnb2F1dGhCdXR0b24nLCBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgc2NvcGU6IHtcbiAgICAgIHByb3ZpZGVyTmFtZTogJ0AnXG4gICAgfSxcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlVXJsOiAnL2pzL2NvbW1vbi9kaXJlY3RpdmVzL29hdXRoLWJ1dHRvbi9vYXV0aC1idXR0b24uaHRtbCdcbiAgfVxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdvcmRlckVudHJ5JywgZnVuY3Rpb24gKE1hbmFnZU9yZGVyc0ZhY3RvcnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL29yZGVyLWVudHJ5L29yZGVyLWVudHJ5Lmh0bWwnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgb3JkZXJEZXRhaWxzOiAnPSdcbiAgICAgICAgfSxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHMsIGUsIGEpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHMub3JkZXJEZXRhaWxzKTtcbiAgICAgICAgfVxuICAgIH1cbn0pXG4iLCJhcHAuY29udHJvbGxlcignT3JkZXJIaXN0b3J5Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSl7XG5cdFxufSkiLCJhcHAuZGlyZWN0aXZlKCdvcmRlckhpc3RvcnknLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9vcmRlci1oaXN0b3J5L29yZGVyLWhpc3RvcnkuaHRtbCcsXG4gICAgICAgIHNjb3BlOiB7XG4gICAgICAgICAgICBoaXN0b3JpZXM6ICc9J1xuICAgICAgICB9LFxuICAgICAgICBjb250cm9sbGVyOiAnT3JkZXJIaXN0b3J5Q3RybCdcbiAgICB9XG59KVxuIiwiYXBwLmNvbnRyb2xsZXIoJ1Byb2R1Y3RDYXJkQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSl7XG5cblxuICAgICRzY29wZS5jYXRlZ29yaWVzID0gW1xuICAgICAgICB7bmFtZTogJ0FsbCd9LFxuICAgICAgICB7bmFtZTogJ0ZpcmUnfSxcbiAgICAgICAge25hbWU6ICdXYXRlcid9LFxuICAgICAgICB7bmFtZTogJ0dyYXNzJ30sXG4gICAgICAgIHtuYW1lOiAnUm9jayd9LFxuICAgICAgICB7bmFtZTogJ0RyYWdvbid9LFxuICAgICAgICB7bmFtZTogJ1BzeWNoaWMnfSxcbiAgICAgICAge25hbWU6ICdJY2UnfSxcbiAgICAgICAge25hbWU6ICdOb3JtYWwnfSxcbiAgICAgICAge25hbWU6ICdCdWcnfSxcbiAgICAgICAge25hbWU6ICdFbGVjdHJpYyd9LFxuICAgICAgICB7bmFtZTogJ0dyb3VuZCd9LFxuICAgICAgICB7bmFtZTogJ0ZhaXJ5J30sXG4gICAgICAgIHtuYW1lOiAnRmlnaHRpbmcnfSxcbiAgICAgICAge25hbWU6ICdHaG9zdCd9LFxuICAgICAgICB7bmFtZTogJ1BvaXNvbid9XG4gICAgXVxuXG4gICAgJHNjb3BlLmZpbHRlciA9IGZ1bmN0aW9uIChjYXRlZ29yeSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHByb2R1Y3QpIHtcbiAgICAgICAgICAgIGlmICghY2F0ZWdvcnkgfHwgY2F0ZWdvcnkgPT09ICdBbGwnKSByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgZWxzZSByZXR1cm4gcHJvZHVjdC5jYXRlZ29yeSA9PT0gY2F0ZWdvcnlcbiAgICAgICAgfTtcbiAgICB9O1xuICAgICRzY29wZS5zZWFyY2hGaWx0ZXI9ZnVuY3Rpb24oc2VhcmNoaW5nTmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHByb2R1Y3QpIHtcbiAgICAgICAgICAgIGlmICghc2VhcmNoaW5nTmFtZSkgcmV0dXJuIHRydWU7ICAgICAgICAgICBcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBsZW4gPSBzZWFyY2hpbmdOYW1lLmxlbmd0aFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwcm9kdWN0JywgcHJvZHVjdC50aXRsZSlcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvZHVjdC50aXRsZS5zdWJzdHJpbmcoMCxsZW4pLnRvTG93ZXJDYXNlKCk9PXNlYXJjaGluZ05hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9XG4gICAgJHNjb3BlLnByaWNlUmFuZ2VGaWx0ZXI9ZnVuY3Rpb24obWluPTAsbWF4PTIwMDApe1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocHJvZHVjdCl7XG4gICAgICAgICAgICByZXR1cm4gcHJvZHVjdC5wcmljZT49bWluICYmIHByb2R1Y3QucHJpY2U8PW1heDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAkc2NvcGUuc29ydGluZ0Z1bmM9ZnVuY3Rpb24oc29ydFR5cGU9XCJ1bnRvdWNoZWRcIil7XG4gICAgICAgIGlmIChzb3J0VHlwZT09PVwidW50b3VjaGVkXCIpIHJldHVybiBudWxsO1xuICAgICAgICBlbHNlIGlmIChzb3J0VHlwZT09PVwibG93XCIpIHJldHVybiAncHJpY2UnXG4gICAgICAgIGVsc2UgaWYgKHNvcnRUeXBlPT09J2hpZ2gnKSByZXR1cm4gJy1wcmljZSdcbiAgICAgICAgfVxufSlcblxuIiwiYXBwLmRpcmVjdGl2ZSgncHJvZHVjdENhcmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9wcm9kdWN0LWNhcmQvcHJvZHVjdC1jYXJkLmh0bWwnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgcHJvZHVjdHM6ICc9J1xuICAgICAgICB9LFxuICAgICAgICBjb250cm9sbGVyOiAnUHJvZHVjdENhcmRDdHJsJ1xuICAgIH1cbn0pXG4iLCJhcHAuZGlyZWN0aXZlKCdwcm9kdWN0RW50cnknLCBmdW5jdGlvbiAoUHJvZHVjdEZhY3RvcnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3Byb2R1Y3QtZW50cnkvcHJvZHVjdC1lbnRyeS5odG1sJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIHByb2R1Y3Q6ICc9JyxcbiAgICAgICAgICAgIG5nTW9kZWw6ICc9J1xuICAgICAgICB9LFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW0sIGF0dHIpIHtcbiAgICAgICAgICAgIHNjb3BlLnN1Ym1pdFVwZGF0ZSA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIFByb2R1Y3RGYWN0b3J5LnVwZGF0ZVByb2R1Y3QoaWQsIHNjb3BlLm5nTW9kZWwpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2NvcGUuZGVsZXRlUHJvZHVjdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIFByb2R1Y3RGYWN0b3J5LmRlbGV0ZVByb2R1Y3QoaWQpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxufSlcbiIsImFwcC5kaXJlY3RpdmUoJ3JhbmRvR3JlZXRpbmcnLCBmdW5jdGlvbiAoUmFuZG9tR3JlZXRpbmdzKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3JhbmRvLWdyZWV0aW5nL3JhbmRvLWdyZWV0aW5nLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICAgICAgICAgIHNjb3BlLmdyZWV0aW5nID0gUmFuZG9tR3JlZXRpbmdzLmdldFJhbmRvbUdyZWV0aW5nKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG59KTsiLCIvLyBhcHAuZGlyZWN0aXZlKCdzdGFyUmF0aW5nJywgZnVuY3Rpb24gKCkge1xuLy8gICAgIHJldHVybiB7XG4vLyAgICAgICByZXN0cmljdDogJ0VBJyxcbi8vICAgICAgIHRlbXBsYXRlOlxuLy8gICAgICAgICAnPHNwYW4gY2xhc3M9XCJzdGFyc1wiPicgK1xuLy8gICAgICAgICAgJzxkaXYgY2xhc3M9XCJzdGFycy1maWxsZWQgbGVmdFwiPicgK1xuLy8gICAgICAgICAgICAgJzxzcGFuPuKYhTwvc3Bhbj4nICtcbi8vICAgICAgICAgICc8L2Rpdj4nICtcbi8vICAgICAgICc8L3NwYW4+J1xuLy8gICAgIH07XG4vLyB9KVxuIiwiIC8vIGFwcC5jb250cm9sbGVyKCdTZWFyY2hCYXJDdHJsJywgZnVuY3Rpb24oJHNjb3BlKXtcbiAvLyBcdCRzY29wZS5wcm9kdWN0PVxuIC8vIH0pIiwiYXBwLmRpcmVjdGl2ZSgnc2VhcmNoQmFyJywgZnVuY3Rpb24oKXtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDonRScsXG5cdFx0dGVtcGxhdGVVcmw6J2pzL2NvbW1vbi9kaXJlY3RpdmVzL3NlYXJjaC1iYXIvc2VhcmNoLWJhci5odG1sJyxcblx0XHRjb250cm9sbGVyOidQcm9kdWN0Q2FyZEN0cmwnXG5cdH1cbn0pXG5cbiIsImFwcC5kaXJlY3RpdmUoJ3VzZXJFbnRyeScsIGZ1bmN0aW9uIChVc2VyRmFjdG9yeSwgQXV0aEZhY3RvcnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3VzZXItZW50cnkvdXNlci1lbnRyeS5odG1sJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIHVzZXI6ICc9JyxcbiAgICAgICAgICAgIG5nTW9kZWw6ICc9J1xuICAgICAgICB9LFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW0sIGF0dHIpIHtcbiAgICAgICAgICAgIHNjb3BlLmZvcmdldFBhc3N3b3JkID0gZnVuY3Rpb24gKGVtYWlsKSB7XG4gICAgICAgICAgICAgICAgQXV0aEZhY3RvcnkuZm9yZ2V0UGFzc3dvcmQoe2VtYWlsOiBlbWFpbH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnRG9uZScsIDEwMDApO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgTWF0ZXJpYWxpemUudG9hc3QoJ09vcHMsIHNvbWV0aGluZyB3ZW50IHdyb25nJywgMTAwMClcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjb3BlLmRlbGV0ZVVzZXIgPSBmdW5jdGlvbiAodXNlcklkKSB7XG4gICAgICAgICAgICAgICAgIFVzZXJGYWN0b3J5LmRlbGV0ZVVzZXIodXNlcklkKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgTWF0ZXJpYWxpemUudG9hc3QoJ0VyYXNlIGZyb20gcGxhbmV0IEVhcnRoJywgMTAwMCk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBNYXRlcmlhbGl6ZS50b2FzdCgnT29wcywgc29tZXRoaW5nIHdlbnQgd3JvbmcnLCAxMDAwKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgndXNlck9yZGVyJywgZnVuY3Rpb24gKE1hbmFnZU9yZGVyc0ZhY3RvcnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3VzZXItb3JkZXIvdXNlci1vcmRlci5odG1sJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIHVzZXJPcmRlcjogJz0nLFxuICAgICAgICAgICAgbmdNb2RlbDogJz0nXG4gICAgICAgIH0sXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbSwgYXR0cikge1xuICAgICAgICAgICAgc2NvcGUudXBkYXRlU3RhdHVzID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgTWFuYWdlT3JkZXJzRmFjdG9yeS51cGRhdGVTdGF0dXMoaWQsIHNjb3BlLm5nTW9kZWwpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2NvcGUuZGVsZXRlVXNlck9yZGVyID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgTWFuYWdlT3JkZXJzRmFjdG9yeS5kZWxldGVVc2VyT3JkZXIoaWQpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxufSlcbiIsIlxuYXBwLmRpcmVjdGl2ZSgnY2xpY2tBbnl3aGVyZUJ1dEhlcmUnLCBmdW5jdGlvbigkZG9jdW1lbnQpe1xuICByZXR1cm4ge1xuICAgICAgICAgICByZXN0cmljdDogJ0EnLFxuICAgICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgICAgY2xpY2tBbnl3aGVyZUJ1dEhlcmU6ICcmJ1xuICAgICAgICAgICB9LFxuICAgICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsLCBhdHRyKSB7XG5cbiAgICAgICAgICAgICAgICQoJy5sb2dvJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSl7XG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAkZG9jdW1lbnQub24oJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQuaWQgIT09ICdjYXJ0LWljb24nICYmIGUudGFyZ2V0LmlkICE9PSAnYWRkLXRvLWNhcnQtYnV0dG9uJykge1xuICAgICAgICAgICAgICAgICAgIGlmIChlbCAhPT0gZS50YXJnZXQgJiYgIWVsWzBdLmNvbnRhaW5zKGUudGFyZ2V0KSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS4kZXZhbChzY29wZS5jbGlja0FueXdoZXJlQnV0SGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgfVxuICAgICAgICB9XG59KTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
