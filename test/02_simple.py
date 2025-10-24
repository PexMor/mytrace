from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# Import aitrace components
from aitrace import auto_span

# Import common test utilities
from common import InspectHandler, init_llm, setup_tracing_and_logging

# Initialize tracing and buffered logging
tracer, buffered = setup_tracing_and_logging("simple-langgraph-app")

# Initialize LLM with llmlite proxy support
llm = init_llm()


class State(TypedDict):
    # Messages have the type "list". The `add_messages` function
    # in the annotation defines how this state key should be updated
    # (in this case, it appends messages to the list, rather than overwriting them)
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)


@auto_span()
def chatbot(state: State):
    """Chatbot function with logging and tracing."""
    log = buffered.logger
    log.info("chatbot_invoked", message_count=len(state["messages"]))
    
    # Create callback handler with logger
    inspect_handler = InspectHandler(log)
    
    # Invoke LLM with callback handler
    response = llm.invoke(state["messages"], config={"callbacks": [inspect_handler]})
    
    log.info("chatbot_response_generated", response_length=len(response.content))
    
    return {"messages": [response]}


# The first argument is the unique node name
# The second argument is the function or object that will be called whenever
# the node is used.
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_edge(START, "chatbot")
graph_builder.add_edge("chatbot", END)


graph = graph_builder.compile()

# Use trace_context for automatic buffer management
with buffered.trace_context(tracer, "user_conversation"):
    user_input = input("Enter a message: ")
    state = graph.invoke({"messages": [{"role": "user", "content": user_input}]})
    
    print(state["messages"][-1].content)
    
    # Log conversation completion
    log = buffered.logger
    log.info("conversation_completed", user_input=user_input)

# Logs automatically flushed when context exits