from typing import Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

# Import aitrace components
from aitrace import auto_span

# Import common test utilities
from common import InspectHandler, init_llm, setup_tracing_and_logging

# Initialize tracing and buffered logging
tracer, buffered = setup_tracing_and_logging("router-langgraph-app")

# Initialize LLM with llmlite proxy support
llm = init_llm()


class MessageClassifier(BaseModel):
    message_type: Literal["emotional", "logical"] = Field(
        ...,
        description="Classify if the message requires an emotional (therapist) or logical response."
    )


class State(TypedDict):
    messages: Annotated[list, add_messages]
    message_type: str | None


@auto_span()
def classify_message(state: State):
    """Classify the message as emotional or logical."""
    log = buffered.logger
    last_message = state["messages"][-1]
    
    log.info("classifying_message", message_preview=last_message.content[:100])
    
    classifier_llm = llm.with_structured_output(MessageClassifier)
    inspect_handler = InspectHandler(log)

    result = classifier_llm.invoke(
        [
            {
                "role": "system",
                "content": """Classify the user message as either:
                - 'emotional': if it asks for emotional support, therapy, deals with feelings, or personal problems
                - 'logical': if it asks for facts, information, logical analysis, or practical solutions
                """
            },
            {"role": "user", "content": last_message.content}
        ],
        config={"callbacks": [inspect_handler]}
    )
    
    log.info("message_classified", message_type=result.message_type)
    return {"message_type": result.message_type}


@auto_span()
def router(state: State):
    """Route to appropriate agent based on message type."""
    log = buffered.logger
    message_type = state.get("message_type", "logical")
    
    log.info("routing_message", message_type=message_type)
    
    if message_type == "emotional":
        next_node = "therapist"
    else:
        next_node = "logical"
    
    log.info("route_determined", next_node=next_node)
    return {"next": next_node}


@auto_span()
def therapist_agent(state: State):
    """Provide emotional support and therapy."""
    log = buffered.logger
    last_message = state["messages"][-1]
    
    log.info("therapist_processing", message_preview=last_message.content[:100])
    
    inspect_handler = InspectHandler(log)
    
    messages = [
        {"role": "system",
         "content": """You are a compassionate therapist. Focus on the emotional aspects of the user's message.
                        Show empathy, validate their feelings, and help them process their emotions.
                        Ask thoughtful questions to help them explore their feelings more deeply.
                        Avoid giving logical solutions unless explicitly asked."""
         },
        {
            "role": "user",
            "content": last_message.content
        }
    ]
    
    reply = llm.invoke(messages, config={"callbacks": [inspect_handler]})
    
    log.info("therapist_response_generated", response_length=len(reply.content))
    return {"messages": [{"role": "assistant", "content": reply.content}]}


@auto_span()
def logical_agent(state: State):
    """Provide logical and factual responses."""
    log = buffered.logger
    last_message = state["messages"][-1]
    
    log.info("logical_processing", message_preview=last_message.content[:100])
    
    inspect_handler = InspectHandler(log)
    
    messages = [
        {"role": "system",
         "content": """You are a purely logical assistant. Focus only on facts and information.
            Provide clear, concise answers based on logic and evidence.
            Do not address emotions or provide emotional support.
            Be direct and straightforward in your responses."""
         },
        {
            "role": "user",
            "content": last_message.content
        }
    ]
    
    reply = llm.invoke(messages, config={"callbacks": [inspect_handler]})
    
    log.info("logical_response_generated", response_length=len(reply.content))
    return {"messages": [{"role": "assistant", "content": reply.content}]}


graph_builder = StateGraph(State)

graph_builder.add_node("classifier", classify_message)
graph_builder.add_node("router", router)
graph_builder.add_node("therapist", therapist_agent)
graph_builder.add_node("logical", logical_agent)

graph_builder.add_edge(START, "classifier")
graph_builder.add_edge("classifier", "router")

graph_builder.add_conditional_edges(
    "router",
    lambda state: state.get("next"),
    {"therapist": "therapist", "logical": "logical"}
)

graph_builder.add_edge("therapist", END)
graph_builder.add_edge("logical", END)

graph = graph_builder.compile()


def run_chatbot():
    """Run the chatbot with automatic trace management per conversation turn."""
    state = {"messages": [], "message_type": None}

    print("Router Chatbot (with tracing)")
    print("=" * 60)
    print("This bot routes to different agents based on your message:")
    print("  - Emotional messages → Therapist agent")
    print("  - Logical messages → Logical agent")
    print("Type 'exit' to quit")
    print("=" * 60)
    print()

    turn_number = 0
    while True:
        user_input = input("Message: ")
        if user_input.lower() == "exit":
            print("Bye! Your conversation traces have been saved.")
            break

        turn_number += 1
        
        # Use trace_context for each conversation turn
        with buffered.trace_context(tracer, f"conversation_turn_{turn_number}"):
            log = buffered.logger
            log.info("user_input_received", turn=turn_number, user_input=user_input)
            
            state["messages"] = state.get("messages", []) + [
                {"role": "user", "content": user_input}
            ]

            state = graph.invoke(state)

            if state.get("messages") and len(state["messages"]) > 0:
                last_message = state["messages"][-1]
                print(f"\nAssistant ({state.get('message_type', 'unknown')} mode): {last_message.content}\n")
                
                log.info("conversation_turn_completed", 
                        turn=turn_number, 
                        agent_type=state.get('message_type', 'unknown'),
                        response_length=len(last_message.content))


if __name__ == "__main__":
    run_chatbot()