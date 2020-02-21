import React from "react";
import classnames from "classnames";

import "./wizard.css";
import { render } from "react-dom";

/** List of questions and possible answers for the Getting Started wizard. */
const questions = {
  git: ["Do you need to be compatible with Git?", ["Yes", "No"]],
  storage: [
    "Where do you want to store data?",
    ["In memory", "On the filesystem"]
  ],
  large: [
    "Do you plan on storing a really large amount of data?",
    ["Yes", "No"]
  ],
  server: [
    "How will you interact with Irmin?",
    ["Using the OCaml API", "Using GraphQL", "Using a REST API"]
  ]
};

/**
 * Set of possible outcomes in the wizard depending on answers.
 *
 * Each outcome has an identifier and an ordered list of answers that lead to it:
 * - the couple `[q, a]` means choosing the answer with index `a` to the question `q`;
 * - the wildcard `q` means choosing any answer to the question `q`.
 *
 * Outcomes should be unambiguous, i.e. there should only be one question to ask next
 * at every possible step in the wizard.
 */
const outcomes = {
  "git-mem": [["git", 0], ["storage", 0], "server"],
  "git-fs": [["git", 0], ["storage", 1], "server"],
  mem: [["git", 1], ["storage", 0], "server"],
  pack: [["git", 1], ["storage", 1], ["large", 0], "server"],
  fs: [["git", 1], ["storage", 1], ["large", 1], "server"]
};

/** A single question from the wizard. */
const Question = props => {
  const { name, questionIndex, currentAnswerIndex, onAnswer } = props;
  const [title, answers] = questions[name];

  let answerButtons = answers.map((answer, i) => (
    <button
      key={i}
      className={classnames("button", { light: currentAnswerIndex !== i })}
      onClick={() => onAnswer(name, questionIndex, i)}
    >
      {answer}
    </button>
  ));

  return (
    <li className="question">
      <h3>{title}</h3>
      <div className="answers">{answerButtons}</div>
    </li>
  );
};

/**
 * Step-by-step wizard for the Getting Started page.
 *
 * This wizard asks the user a series of configurable questions, and uses the
 * answers to provide a list of OPAM packages to install as well as customized
 * code snippets to get create a store, configure it, and create a repository.
 */
class Wizard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { answers: [] };
  }

  /**
   * Triggered when the user answers a question.
   * @param {string} q  The identifier of the question in `questions`.
   * @param {int}    i  The index of the question in the current path.
   * @param {int}    ai The index of the chosen answer.
   */
  answerClicked(q, i, ai) {
    let { answers } = this.state;

    if (i >= answers.length) {
      this.setState({ answers: [...answers, [q, ai]] });
    } else {
      this.setState({ answers: [...answers.slice(0, i), [q, ai]] });
    }
  }

  /**
   * Return which questions to display depending on the previous answers.
   * When an outcome is reached, also returns the identifier of the outcome.
   */
  currentQuestionsAndOutcome() {
    // Extract all the outcomes which are compatible with the previous answers.
    const possibleOutcomes = Object.keys(outcomes).filter(k => {
      const outcome = outcomes[k];
      return this.state.answers.every((choice, index) => {
        // Deal with both the `[q, a]` form and the wildcard `q` form.
        if (Array.isArray(outcome[index])) {
          return (
            outcome[index][0] === choice[0] && outcome[index][1] === choice[1]
          );
        } else {
          return outcome[index] === choice[0];
        }
      });
    });

    if (possibleOutcomes.length === 1) {
      return {
        questions: this.state.answers,
        outcome: possibleOutcomes[0]
      };
    }

    // Find out which question to display next.
    const nextQuestion = possibleOutcomes
      .map(k => outcomes[k][this.state.answers.length])
      .map(a => {
        // Deal with both the `[q, a]` form and the wildcard `q` form.
        if (Array.isArray(a)) return a[0];
        else return a;
      })
      .reduce((acc, curr) => {
        if (acc === curr) return curr;
        else throw `Outcomes are ambiguous, should I ask ${acc} or ${curr}?`;
      });

    return {
      questions: [...this.state.answers, [nextQuestion, null]],
      outcome: null
    };
  }

  render() {
    const { questions, outcome } = this.currentQuestionsAndOutcome();

    let message = <p>You haven't reached an outcome yet.</p>;
    if (outcome !== null) {
      message = <p>You have reached outcome {outcome}.</p>;
    }

    return (
      <div className="wizard">
        <ol>
          {questions.map(([q, ai], i) => (
            <Question
              key={q}
              name={q}
              questionIndex={i}
              currentAnswerIndex={ai}
              onAnswer={this.answerClicked.bind(this)}
            ></Question>
          ))}
        </ol>

        {message}
      </div>
    );
  }
}

export default Wizard;
