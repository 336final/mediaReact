import React from 'react';
import User from './User/User.js';
import { IndexLink, Link} from 'react-router';


export default class extends React.Component{
    constructor() {
        super();
        this.state = {};
    }
    render() {
        return (
            <div>
                <h1>Media React</h1>
                <ul className="header">
                    <li><IndexLink to="/Post" activeClassName="active">Post</IndexLink></li>
                    <li><Link to="/Catalog" activeClassName="active">Catalog</Link></li>
                    <li><Link to="/MyAccount" activeClassName="active">My Account</Link></li>
                    <User/>
                </ul>
                <div className="content">
                    {this.props.children}
                </div>
            </div>
        );
    }
};
