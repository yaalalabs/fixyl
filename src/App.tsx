import React from "react";
import "./App.scss";
import { PopOutWindowContainer } from "./common/PopOutWindow/PopOutWindowContainer";
import { AppLayout } from "./main-layout/AppLayout";
import { LanguageCodes, LM } from "./translations/language-manager";

interface AppState {
  lang?: LanguageCodes;
}

export class App extends React.Component<any, AppState> {
  state = {
    lang: LanguageCodes.ENGLISH,
    
  }

  componentDidMount() {
    LM.getLanguageChangeObservable().subscribe((lang) => {
      this.setState({ lang });
    });
  }


  render() {

    return (
      <React.Fragment>
        <AppLayout />
        <PopOutWindowContainer></PopOutWindowContainer>
      </React.Fragment>
    );
  }
}
