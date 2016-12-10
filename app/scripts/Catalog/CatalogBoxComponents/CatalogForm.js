import React from 'react';

export default class extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            title: '', author: '', year: ''
        }
    }
    handleAuthorChange(e) {
        this.setState({title: e.target.value});
    }
    handleTextChange(e) {
        this.setState({text: e.target.value});
    }
    handleYearChange(e) {
        this.setState({year: e.target.value});
    }
    handleSubmit(e) {
        e.preventDefault();
        var title = this.state.title.trim();
        var text = this.state.text.trim();
        var year = this.state.text.trim();
        if (!text || !title) {
            return;
        }
        this.props.onPostSubmit({title: title, text: text});
        this.setState({title: '', text: '', year: ''});
    }
    render() {
        return (
            <form className="CatalogForm" onSubmit={this.handleSubmit.bind(this)}>
                <input className="ui-widget ui-corner-all" type="text" placeholder="name..."
                    value={this.state.title} onChange={this.handleAuthorChange.bind(this)}
                />
                <input className="ui-widget ui-corner-all" type="text" placeholder="author..."
                    value={this.state.author} onChange={this.handleTextChange.bind(this)}
                />
                <input className="ui-widget ui-corner-all" type="text" placeholder="year..."
                    value={this.state.year} onChange={this.handleYearChange.bind(this)}
                />
                <input className="ui-button ui-widget ui-corner-all" type="submit" value="Post" />
            </form>
        );
    }
};
