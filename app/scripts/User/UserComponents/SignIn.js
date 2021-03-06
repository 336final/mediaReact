import React from "react";
import gapi from "gapi";
import $ from "jquery";

let idSuffixCount = 0;

/*Sign In Component
*Render the sign in page
*
*/

export default class SignIn extends React.Component {
    constructor(props) {
        super(props);
        this.id = 'User-UserComponents-SignIn.js-' + idSuffixCount++;
        this.state = {
        };
    }

    //Posts to the database googleUser info
    componentDidMount() {
        gapi.signin2.render(this.id, {
            scope: "profile email",
            onsuccess : (googleUser) => {
                $.ajax({
                    url: '/api/login',
                    dataType: 'json',
                    type: 'POST',
                    data: {id_token: googleUser.getAuthResponse().id_token}
                })
                .done(function(result) {
                    this.props.onSignIn(googleUser);
                    var profile = googleUser.getBasicProfile();

                    console.log('ID: ' + profile.getId());
                    console.log('Name: ' + profile.getName());
                    console.log('Image URL: ' + profile.getImageUrl());
                    console.log('Email: ' + profile.getEmail());

                    this.props.onSignIn({id: result.userId,
                                        name: profile.getName(),
                                        avatarImageUrl: profile.getImageUrl(),
                                        });
                }.bind(this))
                .fail(function(xhr, status, errorThrown) {
                    console.error('api/login', status, errorThrown.toString());
                }.bind(this));
            },
            onfailure: () => {
                alert("Failed to login");
            }
        });
    }

    static get defaultProps() {
        return {
            onSignIn: () => {},
        };
    }

    render() {
        return (
            <div id={this.id} data-theme="dark"/>
        );
    }
}
